"""CLI helper to push Obsidian markdown notes into OpenSearch."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, Tuple

import yaml
from opensearchpy import helpers

from .config import settings
from .opensearch_rm import create_opensearch_client


def parse_markdown(path: Path) -> Tuple[Dict[str, Any], str]:
    """Return (metadata, content) from a markdown file with optional front matter."""

    text = path.read_text("utf-8")
    metadata: Dict[str, Any] = {}
    content = text

    if text.startswith("---"):
        lines = text.splitlines()
        if lines and lines[0].strip() == "---":
            fm_lines: list[str] = []
            for idx in range(1, len(lines)):
                if lines[idx].strip() == "---":
                    content = "\n".join(lines[idx + 1 :]).strip()
                    try:
                        metadata = yaml.safe_load("\n".join(fm_lines)) or {}
                    except yaml.YAMLError:
                        metadata = {}
                    break
                fm_lines.append(lines[idx])

    return metadata, content


def iter_documents(vault_dir: Path, index: str) -> Iterator[Dict[str, Any]]:
    """Yield OpenSearch bulk actions for every markdown file in the vault."""

    for path in sorted(vault_dir.rglob("*.md")):
        metadata, content = parse_markdown(path)
        rel_path = path.relative_to(vault_dir).as_posix()
        modified = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
        document = {
            "path": rel_path,
            "text": content,
            "metadata": metadata,
            "title": metadata.get("title") or path.stem,
            "modified": modified,
        }
        yield {
            "_index": index,
            "_id": rel_path,
            "_source": document,
        }


def ensure_index(client, index: str) -> None:
    """Create the index if it doesn't exist."""

    if client.indices.exists(index=index):  # type: ignore[attr-defined]
        return

    body = {
        "settings": {"index": {"number_of_shards": 1, "number_of_replicas": 0}},
        "mappings": {
            "properties": {
                "path": {"type": "keyword"},
                "title": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
                "text": {"type": "text"},
                "modified": {"type": "date"},
                "metadata": {"type": "object", "enabled": True},
            }
        },
    }

    client.indices.create(index=index, body=body)  # type: ignore[attr-defined]


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Index Obsidian notes into OpenSearch")
    parser.add_argument("vault", type=Path, help="Path to the root of your Obsidian vault")
    parser.add_argument(
        "--index",
        default=settings.opensearch.index,
        help="Override the OpenSearch index name (defaults to settings.toml)",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)

    if not args.vault.exists():
        raise SystemExit(f"Vault directory '{args.vault}' does not exist")

    client = create_opensearch_client()
    ensure_index(client, args.index)

    actions = iter_documents(args.vault, args.index)
    helpers.bulk(client, actions)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
