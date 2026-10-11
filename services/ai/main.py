"""Local, deterministic lost-and-found matching suggestions; never claim verification."""

from __future__ import annotations

import asyncio
import hmac
import os
import re
from contextlib import asynccontextmanager
from datetime import date
from typing import Annotated, Any, AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_BODY_BYTES = 1024 * 1024
MAX_CANDIDATES = 1200
MAX_SUGGESTIONS = 5
MATCH_TIMEOUT_SECONDS = 60.0
HEURISTIC_SIGNAL_NAME = "hybrid_lexical_category_date_location"
HEURISTIC_SIGNAL_VERSION = "v2"
EMBEDDING_SIGNAL_NAME = "embeddinggemma2_hybrid_lexical_metadata"
EMBEDDING_SIGNAL_VERSION = "v2"

# Contact details do not belong in matching descriptions or locations. Reject them
# rather than attempting to scrub or retain sensitive input.
_EMAIL_RE = re.compile(r"\b[^\s@]+@[^\s@]+\.[^\s@]+\b")
_PHONE_RE = re.compile(r"(?<!\w)(?:\+?\d[\d .()/-]{7,}\d)(?!\w)")
_WORD_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)

@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Load the explicitly configured local checkpoint once at service startup."""
    application.state.embeddinggemma_ranker = None
    model_path = os.getenv("EMBEDDINGGEMMA_MODEL_PATH", "").strip()
    if model_path:
        from embeddinggemma import EmbeddingGemmaRanker

        device = os.getenv("EMBEDDINGGEMMA_DEVICE", "cpu").strip() or "cpu"
        try:
            application.state.embeddinggemma_ranker = await asyncio.to_thread(
                EmbeddingGemmaRanker, model_path, device
            )
        except Exception as exc:
            # Fail closed: an explicitly requested but unusable model must not
            # silently switch to the deterministic fallback.
            raise RuntimeError("Configured local EmbeddingGemma could not be loaded.") from exc
    elif os.getenv("EMBEDDINGGEMMA_REQUIRED", "").strip().lower() == "true":
        raise RuntimeError("EmbeddingGemma is required but no local model path was configured.")
    yield


app = FastAPI(
    title="Lost-and-Found Matching Suggestions",
    version="1.0.0",
    lifespan=lifespan,
)
app.state.embeddinggemma_ranker = None


class BoundedBodyMiddleware:
    """Buffer only up to MAX_BODY_BYTES and reject oversized requests safely."""

    def __init__(self, application: Any, limit: int) -> None:
        self.application = application
        self.limit = limit

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.application(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > self.limit:
                    await self._too_large(scope, receive, send)
                    return
            except ValueError:
                await self._too_large(scope, receive, send)
                return

        messages: list[dict[str, Any]] = []
        size = 0
        while True:
            message = await receive()
            messages.append(message)
            if message["type"] == "http.request":
                size += len(message.get("body", b""))
                if size > self.limit:
                    await self._too_large(scope, receive, send)
                    return
                if not message.get("more_body", False):
                    break
            else:
                break

        index = 0

        async def replay_receive() -> dict[str, Any]:
            nonlocal index
            if index < len(messages):
                current = messages[index]
                index += 1
                return current
            return {"type": "http.request", "body": b"", "more_body": False}

        await self.application(scope, replay_receive, send)

    @staticmethod
    async def _too_large(scope: dict[str, Any], receive: Any, send: Any) -> None:
        response = JSONResponse(status_code=413, content={"detail": "Request body exceeds the 1048576-byte limit."})
        await response(scope, receive, send)


app.add_middleware(BoundedBodyMiddleware, limit=MAX_BODY_BYTES)


def _reject_contact_details(value: str) -> str:
    if _EMAIL_RE.search(value) or _PHONE_RE.search(value):
        raise ValueError("Contact details are not accepted in matching text.")
    return value


class ItemRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    record_id: Annotated[str, Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")]
    category: Annotated[str, Field(max_length=80)] = ""
    description: Annotated[str, Field(default="", max_length=500)]
    observed_date: date | None = None
    location: Annotated[str, Field(max_length=120)] = ""

    @field_validator("category", "description", "location")
    @classmethod
    def validate_text(cls, value: str) -> str:
        return _reject_contact_details(value)

    @field_validator("observed_date", mode="before")
    @classmethod
    def normalize_empty_date(cls, value: Any) -> Any:
        # The Go API serializes unknown dates as an empty string.
        return None if value == "" else value


class MatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: ItemRecord
    candidates: Annotated[list[ItemRecord], Field(max_length=MAX_CANDIDATES)]


class SimilaritySignal(BaseModel):
    name: str
    version: str
    score: Annotated[float, Field(ge=0.0, le=1.0)]
    interpretation: str


class MatchSuggestion(BaseModel):
    candidate_id: str
    rank: int
    signal: SimilaritySignal
    explanations: list[str]


class MatchResponse(BaseModel):
    suggestions: list[MatchSuggestion]
    ranking: str
    notice: str


def _tokens(text: str) -> set[str]:
    return {token.lower() for token in _WORD_RE.findall(text) if len(token) > 1}


def _character_ngrams(text: str, size: int = 3) -> set[str]:
    normalized = " ".join(text.lower().split())
    if not normalized:
        return set()
    padded = f"  {normalized}  "
    return {padded[index : index + size] for index in range(max(1, len(padded) - size + 1))}


def _lexical_similarity(query: ItemRecord, candidate: ItemRecord) -> float:
    """Language-agnostic lexical score: token overlap plus typo-tolerant character overlap."""
    query_text = f"{query.category} {query.description}".strip()
    candidate_text = f"{candidate.category} {candidate.description}".strip()
    query_tokens, candidate_tokens = _tokens(query_text), _tokens(candidate_text)
    token_union = query_tokens | candidate_tokens
    token_score = len(query_tokens & candidate_tokens) / max(1, len(token_union))
    query_grams, candidate_grams = _character_ngrams(query_text), _character_ngrams(candidate_text)
    gram_union = query_grams | candidate_grams
    gram_score = len(query_grams & candidate_grams) / max(1, len(gram_union))
    return round(0.65 * token_score + 0.35 * gram_score, 4)


def _metadata_score(query: ItemRecord, candidate: ItemRecord) -> tuple[float, list[str]]:
    reasons: list[str] = []
    q_category, c_category = _tokens(query.category), _tokens(candidate.category)
    category = bool(q_category and c_category and q_category & c_category)
    q_location, c_location = _tokens(query.location), _tokens(candidate.location)
    location = bool(q_location and c_location and q_location & c_location)
    day_gap = abs((query.observed_date - candidate.observed_date).days) if query.observed_date and candidate.observed_date else None
    date_similarity = max(0.0, 1.0 - day_gap / 31.0) if day_gap is not None else 0.0

    if category:
        reasons.append("Category terms overlap.")
    if day_gap == 0:
        reasons.append("Observed dates are the same.")
    elif day_gap is not None and day_gap <= 7:
        reasons.append("Observed dates are within 7 days.")
    if location:
        reasons.append("Location terms overlap.")
    # Metadata is deliberately separate from lexical and vector evidence.
    score = 0.50 * float(category) + 0.25 * date_similarity + 0.25 * float(location)
    return round(score, 4), reasons


def _rank(request: MatchRequest, embeddinggemma_ranker: Any | None = None) -> list[MatchSuggestion]:
    if not request.candidates:
        return []

    lexical_scores = [_lexical_similarity(request.query, candidate) for candidate in request.candidates]
    metadata = [_metadata_score(request.query, candidate) for candidate in request.candidates]
    semantic_scores = (
        embeddinggemma_ranker.similarities(request.query, request.candidates)
        if embeddinggemma_ranker is not None
        else None
    )
    ranked: list[tuple[float, str, list[str]]] = []
    for index, candidate in enumerate(request.candidates):
        metadata_score, reasons = metadata[index]
        lexical_score = lexical_scores[index]
        if lexical_score >= 0.08:
            reasons.append("Public-safe text has lexical or character-pattern overlap.")
        if semantic_scores is None:
            # Deterministic multilingual-friendly fallback; this remains a ranking aid, not proof.
            score = round(0.70 * lexical_score + 0.30 * metadata_score, 4)
        else:
            semantic_score = semantic_scores[index]
            # Hybrid lexical/vector ordering, with category/date/location as supporting
            # signals. These weights are uncalibrated and never indicate ownership.
            score = round(0.60 * semantic_score + 0.25 * lexical_score + 0.15 * metadata_score, 4)
            reasons.insert(0, "Semantic text similarity contributed to this shortlist.")
        ranked.append((score, candidate.record_id, reasons))
    ranked.sort(key=lambda row: (-row[0], row[1]))

    signal_name = EMBEDDING_SIGNAL_NAME if semantic_scores is not None else HEURISTIC_SIGNAL_NAME
    signal_version = EMBEDDING_SIGNAL_VERSION if semantic_scores is not None else HEURISTIC_SIGNAL_VERSION
    return [
        MatchSuggestion(
            candidate_id=record_id,
            rank=index,
            signal=SimilaritySignal(
                name=signal_name,
                version=signal_version,
                score=score,
                interpretation="uncalibrated_assistive_suggestion_only",
            ),
            explanations=reasons,
        )
        for index, (score, record_id, reasons) in enumerate(ranked[:MAX_SUGGESTIONS], start=1)
    ]


async def require_service_token(authorization: Annotated[str | None, Header()] = None) -> None:
    expected = os.getenv("AI_SERVICE_TOKEN")
    if expected:
        supplied = authorization.removeprefix("Bearer ") if authorization and authorization.startswith("Bearer ") else ""
        if not hmac.compare_digest(supplied, expected):
            raise HTTPException(status_code=401, detail="Unauthorized.", headers={"WWW-Authenticate": "Bearer"})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Do not return rejected input values; request bodies are deliberately never logged.
    return JSONResponse(status_code=422, content={"detail": "Request validation failed."})


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
async def readyz() -> dict[str, str]:
    return {"status": "ready", "ranking": active_ranking()}


def active_ranking() -> str:
    return (
        "embeddinggemma2_hybrid_lexical_metadata_v2"
        if app.state.embeddinggemma_ranker is not None
        else "hybrid_lexical_category_date_location_v2"
    )


@app.post("/v1/matches", response_model=MatchResponse, dependencies=[Depends(require_service_token)])
async def matches(payload: MatchRequest) -> MatchResponse:
    try:
        suggestions = await asyncio.wait_for(
            asyncio.to_thread(_rank, payload, app.state.embeddinggemma_ranker),
            timeout=MATCH_TIMEOUT_SECONDS,
        )
    except TimeoutError as exc:
        raise HTTPException(status_code=503, detail="Matching is temporarily unavailable.") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Matching is temporarily unavailable.") from exc
    return MatchResponse(
        suggestions=suggestions,
        ranking=active_ranking(),
        notice="Suggestions are assistive ranking signals only; review records independently. They do not verify identity or ownership and must not decide or reject a claim.",
    )
