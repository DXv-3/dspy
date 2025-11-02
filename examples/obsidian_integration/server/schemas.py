"""Pydantic request and response models for the FastAPI app."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class MemorySnippet(BaseModel):
    """A single memory item returned from mem0 or supermemory."""

    source: str = Field(..., description="Which backend produced the snippet, e.g. mem0 or supermemory")
    text: str = Field(..., description="Raw text body of the memory")
    metadata: dict[str, str] = Field(default_factory=dict, description="Optional metadata key/value pairs")


class RetrievalHit(BaseModel):
    """A passage returned from OpenSearch."""

    id: str
    score: float
    text: str
    metadata: dict[str, str] = Field(default_factory=dict)


class PredictRequest(BaseModel):
    """Payload sent from the Obsidian plugin."""

    prompt: str = Field(..., description="Selected text or note contents")
    note_path: str | None = Field(default=None, description="Obsidian path of the active note")
    include_memory: bool = Field(default=True)
    include_retrieval: bool = Field(default=True)


class PredictResponse(BaseModel):
    """Response sent back to the plugin."""

    output: str
    memories: List[MemorySnippet] = Field(default_factory=list)
    retrievals: List[RetrievalHit] = Field(default_factory=list)
    raw_program_output: Optional[dict] = Field(default=None, description="The raw DSPy program return value")


class HealthResponse(BaseModel):
    status: str = "ok"
