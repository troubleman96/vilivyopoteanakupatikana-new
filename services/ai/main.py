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

MAX_BODY_BYTES = 64 * 1024
MAX_CANDIDATES = 50
MATCH_TIMEOUT_SECONDS = 8.0
HEURISTIC_SIGNAL_NAME = "lexical_category_date_location"
HEURISTIC_SIGNAL_VERSION = "v1"
EMBEDDING_SIGNAL_NAME = "embeddinggemma2_semantic_with_metadata"
EMBEDDING_SIGNAL_VERSION = "v1"

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
            # silently switch to the legacy heuristic.
            raise RuntimeError("Configured local EmbeddingGemma could not be loaded.") from exc
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
        response = JSONResponse(status_code=413, content={"detail": "Request body exceeds the 65536-byte limit."})
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
    notice: str


def _tokens(text: str) -> set[str]:
    return {token.lower() for token in _WORD_RE.findall(text) if len(token) > 1}


def _score(query: ItemRecord, candidate: ItemRecord) -> tuple[float, list[str]]:
    reasons: list[str] = []
    q_category, c_category = _tokens(query.category), _tokens(candidate.category)
    category = bool(q_category and c_category and q_category & c_category)
    q_description, c_description = _tokens(query.description), _tokens(candidate.description)
    description = len(q_description & c_description) / max(1, len(q_description | c_description))
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
    if description > 0:
        reasons.append("Description terms overlap.")

    # Fixed weighted lexical heuristic. This is a ranking signal, not a probability.
    score = 0.35 * float(category) + 0.20 * date_similarity + 0.20 * float(location) + 0.25 * description
    return round(score, 4), reasons or ["No notable category, date, location, or description overlap."]


def _rank(request: MatchRequest, embeddinggemma_ranker: Any | None = None) -> list[MatchSuggestion]:
    if not request.candidates:
        return []

    semantic_scores = (
        embeddinggemma_ranker.similarities(request.query, request.candidates)
        if embeddinggemma_ranker is not None
        else None
    )
    ranked: list[tuple[float, str, list[str]]] = []
    for index, candidate in enumerate(request.candidates):
        metadata_score, reasons = _score(request.query, candidate)
        if semantic_scores is None:
            score = metadata_score
        else:
            semantic_score = semantic_scores[index]
            # Semantic similarity leads; dates and location remain supporting
            # signals. This is an uncalibrated ranking score, never confidence.
            score = round(0.75 * semantic_score + 0.25 * metadata_score, 4)
            reasons = ["Semantic text similarity surfaced this candidate.", *reasons]
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
        for index, (score, record_id, reasons) in enumerate(ranked, start=1)
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
    ranking = (
        "embeddinggemma2_semantic_with_metadata_v1"
        if app.state.embeddinggemma_ranker is not None
        else "local_deterministic_v1"
    )
    return {"status": "ready", "ranking": ranking}


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
        notice="Suggestions are assistive ranking signals only; review records independently. They do not verify identity or ownership and must not decide or reject a claim.",
    )
