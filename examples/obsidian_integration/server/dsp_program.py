"""DSPy program definition for the Obsidian integration."""
from __future__ import annotations

from functools import lru_cache
from typing import Iterable, List

import dspy

from .config import settings
from .opensearch_rm import OpenSearchRM


class NoteResponder(dspy.Module):
    """Simple DSPy module that reasons over note context and optional memories."""

    def __init__(self) -> None:
        super().__init__()
        self.generate = dspy.ChainOfThought("context, memories, retrievals -> response")

    def forward(
        self,
        context: str,
        memories: Iterable[str] | None = None,
        retrievals: Iterable[str] | None = None,
    ) -> dspy.Prediction:
        merged_context: List[str] = [context]
        if memories:
            merged_context.append("\n\n".join(memories))
        if retrievals:
            merged_context.append("\n\n".join(retrievals))
        prompt = "\n\n---\n\n".join(merged_context)
        return self.generate(context=prompt, memories="", retrievals="")


@lru_cache(maxsize=1)
def build_program() -> NoteResponder:
    """Configure DSPy settings and return a compiled program."""

    lm = dspy.LM(settings.llm.provider, temperature=settings.llm.temperature, api_key=settings.llm.api_key)
    rm = OpenSearchRM()
    dspy.settings.configure(lm=lm, rm=rm)
    return NoteResponder()
