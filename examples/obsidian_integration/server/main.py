"""FastAPI app that exposes the DSPy Obsidian integration."""
from __future__ import annotations

import json
from collections.abc import Iterable, Iterator
from typing import Any, List, Tuple

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import settings
from .dsp_program import build_program
from .memories import MemoryProvider, active_memory_providers
from .opensearch_rm import OpenSearchRM
from .schemas import (
    HealthResponse,
    MemorySnippet,
    PredictRequest,
    PredictResponse,
    RetrievalHit,
)

app = FastAPI(title="DSPy Obsidian Integration")

if settings.allow_cross_origin:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def require_api_key(authorization: str | None = Header(default=None)) -> None:
    """Ensure the client supplied the expected bearer token when configured."""

    if settings.api_key is None:
        return

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = authorization.split(" ", 1)[1].strip()
    if token != settings.api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")


@app.get("/health", response_model=HealthResponse)
def health(_: None = Depends(require_api_key)) -> HealthResponse:
    return HealthResponse()


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest, _: None = Depends(require_api_key)) -> PredictResponse:
    output, memories, retrievals, raw_output = _run_prediction(request)
    return PredictResponse(
        output=output,
        memories=memories,
        retrievals=retrievals,
        raw_program_output=raw_output,
    )


@app.post("/predict/stream")
def predict_stream(request: PredictRequest, _: None = Depends(require_api_key)) -> StreamingResponse:
    output, memories, retrievals, raw_output = _run_prediction(request)

    def event_stream() -> Iterator[str]:
        metadata_event = json.dumps(
            {
                "type": "metadata",
                "memories": [snippet.model_dump() for snippet in memories],
                "retrievals": [hit.model_dump() for hit in retrievals],
                "raw_program_output": raw_output,
            }
        )
        yield f"data: {metadata_event}\n\n"

        for chunk in _chunk_text(output):
            yield f"data: {json.dumps({'type': 'chunk', 'delta': chunk})}\n\n"

        completion_event = json.dumps(
            {
                "type": "complete",
                "output": output,
                "memories": [snippet.model_dump() for snippet in memories],
                "retrievals": [hit.model_dump() for hit in retrievals],
                "raw_program_output": raw_output,
            }
        )
        yield f"data: {completion_event}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )


def _run_prediction(request: PredictRequest) -> Tuple[str, List[MemorySnippet], List[RetrievalHit], dict]:
    program = build_program()
    memory_providers: List[MemoryProvider] = active_memory_providers() if request.include_memory else []

    collected_memories: List[MemorySnippet] = []
    memory_texts: List[str] = []
    for provider in memory_providers:
        for snippet in provider.recall(request.note_path):
            collected_memories.append(snippet)
            memory_texts.append(snippet.text)

    retrieval_hits, retrieval_texts = _collect_retrievals(request, request.include_retrieval)

    prediction = program(context=request.prompt, memories=memory_texts, retrievals=retrieval_texts)
    output_text = prediction.response if hasattr(prediction, "response") else str(prediction)

    for provider in memory_providers:
        provider.remember(request.note_path, output_text)

    raw_program_output = _serialize_program_output(prediction)
    return output_text, collected_memories, retrieval_hits, raw_program_output


def _collect_retrievals(
    request: PredictRequest, include_retrieval: bool
) -> Tuple[List[RetrievalHit], Iterable[str]]:
    if not include_retrieval:
        return [], []

    retriever = OpenSearchRM()
    retrieval_examples = list(retriever.forward(request.prompt, k=4))
    retrieval_hits: List[RetrievalHit] = [
        RetrievalHit(
            id=str(example.id),
            score=getattr(example, "score", 0.0),
            text=example.long_text,
            metadata=getattr(example, "metadata", {}),
        )
        for example in retrieval_examples
    ]
    retrieval_texts = [hit.text for hit in retrieval_hits]
    return retrieval_hits, retrieval_texts


def _chunk_text(text: str, size: int = 200) -> Iterator[str]:
    if not text:
        return

    for start in range(0, len(text), size):
        chunk = text[start : start + size]
        if chunk:
            yield chunk


def _serialize_program_output(prediction: Any) -> dict[str, Any]:
    """Convert a DSPy program return object into JSON-serializable primitives."""

    raw = getattr(prediction, "__dict__", {})

    def convert(value: Any) -> Any:
        if isinstance(value, (str, int, float, bool)) or value is None:
            return value

        if isinstance(value, dict):
            return {str(key): convert(val) for key, val in value.items()}

        if isinstance(value, (list, tuple, set)):
            return [convert(item) for item in value]

        return repr(value)

    if isinstance(raw, dict):
        return {str(key): convert(val) for key, val in raw.items()}

    return {}


__all__ = ["app"]
