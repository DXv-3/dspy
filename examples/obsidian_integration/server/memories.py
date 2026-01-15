"""Wrappers for mem0 and supermemory providers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

from .config import settings
from .schemas import MemorySnippet

try:
    import mem0  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    mem0 = None  # type: ignore

try:
    import supermemory  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    supermemory = None  # type: ignore


@dataclass
class MemoryProvider:
    """Base class for memory adapters."""

    name: str

    def recall(self, note_path: str | None) -> Iterable[MemorySnippet]:  # pragma: no cover - interface
        raise NotImplementedError

    def remember(self, note_path: str | None, text: str) -> None:  # pragma: no cover - interface
        raise NotImplementedError


class Mem0Provider(MemoryProvider):
    """Adapter that calls mem0 if it is installed and configured."""

    def __init__(self) -> None:
        super().__init__(name="mem0")
        self._client = None
        if mem0 is not None and settings.memories.mem0_api_key:
            self._client = mem0.Client(api_key=settings.memories.mem0_api_key)

    def recall(self, note_path: str | None) -> Iterable[MemorySnippet]:
        if self._client is None:
            return []
        query = note_path or "default"
        docs = self._client.search(namespace=settings.memories.namespace, query=query)  # type: ignore[attr-defined]
        for doc in docs:
            yield MemorySnippet(source=self.name, text=doc.get("text", ""), metadata=doc.get("metadata", {}))

    def remember(self, note_path: str | None, text: str) -> None:
        if self._client is None:
            return
        payload = {"text": text, "metadata": {"note_path": note_path or "default"}}
        self._client.store(namespace=settings.memories.namespace, document=payload)  # type: ignore[attr-defined]


class SuperMemoryProvider(MemoryProvider):
    """Adapter for the supermemory package."""

    def __init__(self) -> None:
        super().__init__(name="supermemory")
        self._client = None
        if supermemory is not None and settings.memories.supermemory_api_key:
            self._client = supermemory.Client(api_key=settings.memories.supermemory_api_key)

    def recall(self, note_path: str | None) -> Iterable[MemorySnippet]:
        if self._client is None:
            return []
        query = note_path or "default"
        docs = self._client.search(namespace=settings.memories.namespace, query=query)  # type: ignore[attr-defined]
        for doc in docs:
            yield MemorySnippet(source=self.name, text=doc.get("text", ""), metadata=doc.get("metadata", {}))

    def remember(self, note_path: str | None, text: str) -> None:
        if self._client is None:
            return
        payload = {"text": text, "metadata": {"note_path": note_path or "default"}}
        self._client.store(namespace=settings.memories.namespace, document=payload)  # type: ignore[attr-defined]


def active_memory_providers() -> List[MemoryProvider]:
    """Instantiate every provider that has credentials configured."""

    providers: List[MemoryProvider] = []
    mem0_provider = Mem0Provider()
    if mem0_provider._client is not None:  # pylint: disable=protected-access
        providers.append(mem0_provider)

    supermemory_provider = SuperMemoryProvider()
    if supermemory_provider._client is not None:  # pylint: disable=protected-access
        providers.append(supermemory_provider)

    return providers
