"""Utilities for importing and exporting memories across providers."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable, List, Sequence

from .memories import MemoryProvider, active_memory_providers
from .schemas import MemorySnippet


def _load_memory_file(path: Path) -> List[MemorySnippet]:
    """Parse a JSON export into `MemorySnippet` objects."""

    raw = json.loads(path.read_text())
    if isinstance(raw, dict):
        if "memories" in raw and isinstance(raw["memories"], list):
            items = raw["memories"]
        elif "entries" in raw and isinstance(raw["entries"], list):
            items = raw["entries"]
        else:
            items = [raw]
    elif isinstance(raw, list):
        items = raw
    else:
        raise ValueError("Unsupported JSON structure: expected dict or list")

    snippets: List[MemorySnippet] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        text = item.get("text") or item.get("summary") or item.get("content")
        if not text:
            continue
        metadata = item.get("metadata") or {}
        if "note_path" not in metadata and item.get("note_path"):
            metadata["note_path"] = item["note_path"]
        snippets.append(
            MemorySnippet(
                source=item.get("source", "external"),
                text=text,
                metadata={k: str(v) for k, v in metadata.items()},
            )
        )
    return snippets


def import_memories(
    snippets: Sequence[MemorySnippet],
    note_path: str | None = None,
    provider_names: Sequence[str] | None = None,
) -> int:
    """Push snippets into the configured memory providers."""

    providers = _select_providers(provider_names)
    if not providers:
        raise RuntimeError("No active memory providers are configured.")

    imported = 0
    for snippet in snippets:
        target_path = note_path or snippet.metadata.get("note_path")
        for provider in providers:
            provider.remember(target_path, snippet.text)
        imported += 1
    return imported


def export_memories(
    output_path: Path,
    note_path: str | None = None,
    provider_names: Sequence[str] | None = None,
) -> int:
    """Dump memories from the configured providers to a JSON file."""

    providers = _select_providers(provider_names)
    if not providers:
        raise RuntimeError("No active memory providers are configured.")

    exported: List[dict] = []
    for provider in providers:
        for snippet in provider.recall(note_path):
            payload = snippet.model_dump()
            payload.setdefault("provider", provider.name)
            exported.append(payload)

    output_path.write_text(json.dumps({"note_path": note_path, "memories": exported}, indent=2))
    return len(exported)


def _select_providers(provider_names: Sequence[str] | None) -> List[MemoryProvider]:
    providers = active_memory_providers()
    if provider_names:
        lookup = {name.lower() for name in provider_names}
        providers = [provider for provider in providers if provider.name.lower() in lookup]
    return providers


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import/export memories across providers.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="Import memories from a JSON file")
    import_parser.add_argument("source", type=Path, help="Path to the JSON export to load")
    import_parser.add_argument("--note-path", dest="note_path", help="Override the note path for imported items")
    import_parser.add_argument(
        "--provider",
        dest="providers",
        action="append",
        help="Optional provider name filter (repeatable)",
    )

    export_parser = subparsers.add_parser("export", help="Export memories to a JSON file")
    export_parser.add_argument("destination", type=Path, help="Where to write the JSON export")
    export_parser.add_argument("--note-path", dest="note_path", help="Restrict export to a single note path")
    export_parser.add_argument(
        "--provider",
        dest="providers",
        action="append",
        help="Optional provider name filter (repeatable)",
    )

    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    if args.command == "import":
        snippets = _load_memory_file(args.source)
        count = import_memories(snippets, note_path=args.note_path, provider_names=args.providers)
        print(f"Imported {count} memories into {', '.join(p.name for p in _select_providers(args.providers))}")
        return 0

    if args.command == "export":
        count = export_memories(args.destination, note_path=args.note_path, provider_names=args.providers)
        print(f"Exported {count} memories to {args.destination}")
        return 0

    parser.error("No command provided")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
