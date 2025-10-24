# Cleaning Placeholder Content with DSPy Utils

The :mod:`dspy.utils.data_cleaning` helpers provide a small toolkit for
transforming template-heavy corpora before they are fed into DSPy pipelines.  A
common scenario when bootstrapping new projects is that prompts or documents are
seeded with lorem ipsum or placeholder tokens.  The utilities added in this
release make it trivial to replace that filler text with your own content.

## Removing Filler Lines

```python
from dspy.utils import remove_filler_lines

template = """\
Executive Summary
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Mock Data
"""

print(remove_filler_lines(template))
```

Output:

```
Executive Summary
```

``remove_filler_lines`` defaults to a small set of boilerplate patterns that are
easy to extend with additional regular expressions if needed.

## Replacing Placeholders

```python
from dspy.utils import replace_placeholders

template = """\
Title: {{ title }}
Owner: {{owner}}
"""

payload = {"title": "Unified Agent Blueprint", "owner": "Research Guild"}

print(replace_placeholders(template, payload))
```

Output:

```
Title: Unified Agent Blueprint
Owner: Research Guild
```

The helper works with any prefix or suffix combination, making it compatible
with most templating conventions.

## Putting It Together

```python
from dspy.utils import clean_template

blueprint = """\
Lorem ipsum dolor sit amet
{{product}} orchestrates {{capability}}
mock data
"""

print(
    clean_template(
        blueprint,
        {"product": "Asteria", "capability": "browser and research workflows"},
    )
)
```

Output:

```
Asteria orchestrates browser and research workflows
```

``clean_template`` simply chains the previous helpers together, which keeps the
API ergonomic when preparing templated corpora for demonstrations or tests.
