"""Local EmbeddingGemma 2 text encoder for assistive candidate ranking.

The model is loaded only from an explicitly configured local directory. This
module never downloads weights or stores embeddings between requests.
"""
from __future__ import annotations

import math
import os
import threading
from typing import Any, Sequence


class EmbeddingGemmaRanker:
    """Encode one query and its candidates with EmbeddingGemma 2 retrieval prompts."""

    def __init__(self, model_path: str, device: str = "cpu", batch_size: int = 16) -> None:
        if not os.path.isdir(model_path):
            raise RuntimeError("EmbeddingGemma model path must be an existing local directory.")

        # Import the large ML runtime only when the opt-in model path is configured.
        import torch
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(
            model_path,
            device=device,
            local_files_only=True,
            trust_remote_code=False,
            # The service embeds text only; omit unused vision/audio weights.
            config_kwargs={"vision_config": None, "audio_config": None},
            # EmbeddingGemma 2 must not run in float16; float32 is CPU-safe.
            model_kwargs={"torch_dtype": torch.float32},
        )
        self.batch_size = max(1, min(batch_size, 50))
        self._encode_lock = threading.Lock()

    @staticmethod
    def _query_text(item: Any) -> str:
        category = item.category.strip()
        description = item.description.strip()
        text = "\n".join(part for part in (f"Category: {category}" if category else "", f"Description: {description}" if description else "") if part)
        return text or "Unspecified lost or found item."

    @staticmethod
    def _document_text(item: Any) -> str:
        # The Document prompt supplies the required `title: none` prefix.
        return EmbeddingGemmaRanker._query_text(item)

    def similarities(self, query: Any, candidates: Sequence[Any]) -> list[float]:
        if not candidates:
            return []

        query_text = self._query_text(query)
        documents = [self._document_text(candidate) for candidate in candidates]
        with self._encode_lock:
            query_vector = self.model.encode(
                query_text,
                prompt_name="SearchQuery",
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
            document_vectors = self.model.encode(
                documents,
                prompt_name="Document",
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
                batch_size=self.batch_size,
            )

        similarities: list[float] = []
        for vector in document_vectors:
            similarity = float(vector @ query_vector)
            if not math.isfinite(similarity):
                raise RuntimeError("EmbeddingGemma returned a non-finite similarity.")
            # The API exposes a bounded, uncalibrated ordering score.
            similarities.append(max(0.0, min(1.0, similarity)))
        return similarities
