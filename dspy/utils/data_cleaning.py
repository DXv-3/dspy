"""Utility helpers for normalizing prompt templates and removing filler text.

These helpers are intentionally lightweight so they can be used before any
heavyweight model calls or dataset loading.  They provide two core utilities:

``remove_filler_lines``
    Strip out lines that match a configurable list of "filler" patterns, such
    as lorem ipsum snippets or placeholder markers that often ship with
    template repositories.

``replace_placeholders``
    Swap placeholder tokens with user supplied content.  The helper is aware of
    common ``{{variable}}`` style template markers, but it can be configured to
    operate on any prefix/suffix pair.

The module is purposely free of third-party dependencies and relies only on the
standard library.  Functions return the processed text so they can be chained or
used in a functional pipeline style.
"""

from __future__ import annotations

import re
from typing import Iterable, Mapping, Pattern, Sequence

# Default patterns that frequently appear in boilerplate templates.  The
# patterns are kept small on purpose so they are safe to execute repeatedly when
# processing large corpora of text files.
DEFAULT_FILLER_PATTERNS: Sequence[str] = (
    r"\blorem ipsum\b",
    r"\bplaceholder text\b",
    r"\bmock data\b",
)


def _compile_patterns(patterns: Iterable[Pattern[str] | str]) -> Sequence[Pattern[str]]:
    """Compile a collection of regex patterns.

    Parameters
    ----------
    patterns:
        Iterable of patterns expressed either as raw strings or compiled
        ``re.Pattern`` instances.  Strings are compiled using ``re.IGNORECASE``
        so matches are resilient to capitalization differences.
    """

    compiled: list[Pattern[str]] = []
    for pattern in patterns:
        if isinstance(pattern, re.Pattern):
            compiled.append(pattern)
        else:
            compiled.append(re.compile(pattern, re.IGNORECASE))
    return compiled


def remove_filler_lines(
    text: str,
    *,
    filler_patterns: Iterable[Pattern[str] | str] | None = None,
) -> str:
    """Remove lines that match filler patterns from ``text``.

    The helper operates on a line-by-line basis which keeps the operation cheap
    and preserves line ordering for the remaining content.  A line is dropped if
    **any** filler pattern matches the stripped line contents.  Trailing newlines
    are preserved to reduce surprising diffs when the cleaned text is written
    back to disk.
    """

    if not text:
        return text

    patterns = _compile_patterns(filler_patterns or DEFAULT_FILLER_PATTERNS)

    cleaned_lines: list[str] = []
    for raw_line in text.splitlines():
        stripped = raw_line.strip()
        if any(pattern.search(stripped) for pattern in patterns):
            continue
        cleaned_lines.append(raw_line)

    # ``splitlines`` drops the trailing newline, so we mirror ``text``'s ending
    # newline if it existed to make the function idempotent for append pipelines.
    ending = "\n" if text.endswith("\n") else ""
    return "\n".join(cleaned_lines) + ending


def replace_placeholders(
    text: str,
    replacements: Mapping[str, str],
    *,
    prefix: str = "{{",
    suffix: str = "}}",
) -> str:
    """Replace placeholder markers in ``text`` with values from ``replacements``.

    Parameters
    ----------
    text:
        The source template containing placeholder markers.
    replacements:
        Mapping of placeholder names to replacement text.  Keys should be the
        placeholder name without the surrounding prefix/suffix.
    prefix / suffix:
        Customize the placeholder envelope.  By default the function looks for
        ``{{name}}`` markers which are common in prompt templates.  Prefix and
        suffix are treated literally, allowing strings such as ``"<<"`` or
        ``"%%"``.
    """

    if not replacements:
        return text

    escaped_prefix = re.escape(prefix)
    escaped_suffix = re.escape(suffix)

    def replace_match(match: re.Match[str]) -> str:
        placeholder = match.group("placeholder")
        return replacements.get(placeholder, match.group(0))

    pattern = re.compile(
        rf"{escaped_prefix}\s*(?P<placeholder>[a-zA-Z0-9_.-]+)\s*{escaped_suffix}"
    )
    return pattern.sub(replace_match, text)


def clean_template(
    text: str,
    replacements: Mapping[str, str],
    *,
    filler_patterns: Iterable[Pattern[str] | str] | None = None,
    prefix: str = "{{",
    suffix: str = "}}",
) -> str:
    """High-level helper that removes filler lines before applying replacements.

    ``clean_template`` is a small convenience wrapper so callers only have to
    perform a single function call when preparing templates.  The helper mirrors
    the behaviour of calling ``remove_filler_lines`` followed by
    ``replace_placeholders``.
    """

    cleaned = remove_filler_lines(text, filler_patterns=filler_patterns)
    return replace_placeholders(cleaned, replacements, prefix=prefix, suffix=suffix)


__all__ = [
    "DEFAULT_FILLER_PATTERNS",
    "clean_template",
    "remove_filler_lines",
    "replace_placeholders",
]

