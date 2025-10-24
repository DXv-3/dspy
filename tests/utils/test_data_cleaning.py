import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[2] / "dspy" / "utils" / "data_cleaning.py"
spec = importlib.util.spec_from_file_location("data_cleaning", MODULE_PATH)
data_cleaning = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(data_cleaning)  # type: ignore[arg-type]


DEFAULT_FILLER_PATTERNS = data_cleaning.DEFAULT_FILLER_PATTERNS
clean_template = data_cleaning.clean_template
remove_filler_lines = data_cleaning.remove_filler_lines
replace_placeholders = data_cleaning.replace_placeholders


def test_remove_filler_lines_ignores_lorem_ipsum():
    raw = "Header\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\nBody"
    cleaned = remove_filler_lines(raw)
    assert cleaned == "Header\nBody"


def test_remove_filler_lines_preserves_trailing_newline():
    raw = "keep me\nmock data\n"
    cleaned = remove_filler_lines(raw)
    assert cleaned == "keep me\n"


def test_replace_placeholders_with_defaults():
    template = "Title: {{ title }}\nAuthor: {{author}}"
    actual = replace_placeholders(
        template,
        {
            "title": "My Document",
            "author": "Ada Lovelace",
        },
    )
    assert actual == "Title: My Document\nAuthor: Ada Lovelace"


def test_clean_template_runs_full_pipeline():
    template = "Lorem ipsum\n{{name}} builds\nmock data\n"
    result = clean_template(template, {"name": "The team"})
    assert result == "The team builds\n"


def test_default_filler_patterns_are_configurable():
    template = "Intro\nFILLER\nOutro"
    patterns = list(DEFAULT_FILLER_PATTERNS) + [r"^FILLER$"]
    assert remove_filler_lines(template, filler_patterns=patterns) == "Intro\nOutro"
