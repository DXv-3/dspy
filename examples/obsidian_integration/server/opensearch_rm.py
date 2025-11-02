"""DSPy retriever that queries OpenSearch."""
from __future__ import annotations

import logging
from typing import Any, Dict, Iterable, List, Optional

import dspy
from opensearchpy import OpenSearch, exceptions as os_exceptions

from .config import settings


logger = logging.getLogger(__name__)


def create_opensearch_client() -> OpenSearch:
    """Construct an OpenSearch client based on the loaded settings."""

    auth: Dict[str, Any] = {}
    if settings.opensearch.username and settings.opensearch.password:
        auth["http_auth"] = (settings.opensearch.username, settings.opensearch.password)
    return OpenSearch(
        hosts=[settings.opensearch.host],
        verify_certs=settings.opensearch.verify_certs,
        **auth,
    )


class OpenSearchRM(dspy.Retrieve):
    """Retrieve passages from an OpenSearch index."""

    def __init__(
        self,
        client: Optional[OpenSearch] = None,
        index: Optional[str] = None,
        fields: Optional[List[str]] = None,
        highlight: bool = True,
        k: int = 4,
    ) -> None:
        self.client = client or create_opensearch_client()
        self.index = index or settings.opensearch.index
        self.fields = fields or ["text"]
        self.highlight = highlight
        super().__init__(k=k)

    def forward(self, query: str, k: int | None = None) -> Iterable[dspy.Example]:
        k = k or self.k
        body: Dict[str, Any] = {
            "size": k,
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": self.fields,
                    "type": "best_fields",
                }
            },
        }
        if self.highlight:
            body["highlight"] = {"fields": {field: {} for field in self.fields}}

        try:
            response = self.client.search(index=self.index, body=body)
        except os_exceptions.OpenSearchException as exc:  # pragma: no cover - network dependent
            logger.warning("OpenSearch query failed: %s", exc)
            return []

        hits = response.get("hits", {}).get("hits", [])

        for hit in hits:
            source = hit.get("_source", {})
            long_text = source.get(self.fields[0], "")
            metadata = {k: v for k, v in source.items() if k not in self.fields}
            if self.highlight:
                highlight = hit.get("highlight", {})
                fragments = []
                for fragments_list in highlight.values():
                    fragments.extend(fragments_list)
                if fragments:
                    long_text = "\n".join(fragments)
            yield dspy.Example(
                id=str(hit.get("_id")),
                score=float(hit.get("_score", 0.0)),
                long_text=long_text,
                metadata=metadata,
            )
