# DSPy Ecosystem GitHub Repositories

_Last updated: October 25, 2025._

The DSPy ecosystem is growing quickly. This page curates actively maintained GitHub projects that extend the core framework with tooling, observability, deployment, and evaluation capabilities. Each entry includes why it matters for DSPy users and suggestions for integrating it into your workflows.

## Methodology

The projects below were identified via the public GitHub Search API using the queries `topic:dspy` and `dspy language model` (sorted by stars) on October 25, 2025. Star counts are included to help you judge community adoption at the time of writing; expect them to evolve. Always review each repository's license and maintenance status before adopting it in production.

## Core and Language-Specific Frameworks

| Repository | Stars (Oct 2025) | What it offers | How it complements DSPy |
| --- | --- | --- | --- |
| [ax-llm/ax](https://github.com/ax-llm/ax) | 2.2k | A TypeScript-first re-imagining of DSPy with type-safe pipelines and inference server integration. | Use it when you want to author DSPy-style programs in TypeScript, interoperate with existing JavaScript tooling, or port prototypes from this repo into front-end or NodeJS runtimes. |
| [seanchatmangpt/dspygen](https://github.com/seanchatmangpt/dspygen) | 132 | Rails-inspired scaffolding that generates DSPy modules, signatures, and tests with conventions for larger apps. | Kickstart greenfield projects with opinionated generators, then link the generated modules back into this repository as reusable packages or tutorials. |
| [teilomillet/gollm](https://github.com/teilomillet/gollm) | 582 | Unified Go SDK for orchestrating prompts, retries, and tool use across LLM providers. | Pair it with DSPy's Python runtime by exposing REST or gRPC endpoints for Go microservices, enabling polyglot teams to consume DSPy programs. |

## Optimization, Evaluation, and Observability

| Repository | Stars (Oct 2025) | What it offers | How it complements DSPy |
| --- | --- | --- | --- |
| [langwatch/langwatch](https://github.com/langwatch/langwatch) | 2.6k | Open-source LLM Ops suite with tracing, analytics, dataset curation, and evaluation workflows. | Instrument DSPy programs with Langwatch SDK exporters to capture assertions, intermediate calls, and optimizer runs for team dashboards. |
| [GenseeAI/cognify](https://github.com/GenseeAI/cognify) | 260 | Automated workflow autotuning across LangChain, LangGraph, and DSPy pipelines. | Treat Cognify as an experimentation harness: feed it your DSPy modules to search for lower cost or higher-quality hyperparameters, then upstream successful configurations here. |
| [haizelabs/dspy-redteam](https://github.com/haizelabs/dspy-redteam) | 234 | Adversarial evaluation recipes built on DSPy for safety and red-teaming. | Import its DSPy modules to benchmark your own programs, or adapt their assertion suites as templates for stricter safety evaluations in this repo. |

## Creative Interfaces and Workflow Builders

| Repository | Stars (Oct 2025) | What it offers | How it complements DSPy |
| --- | --- | --- | --- |
| [tom-doerr/dspy_nodes](https://github.com/tom-doerr/dspy_nodes) | 197 | ComfyUI nodes that translate visual workflows into DSPy pipelines. | Ideal for designers or prototypers—sketch flows in ComfyUI, export the generated DSPy pipeline, and iterate on it alongside our Python examples. |
| [weaviate/structured-rag](https://github.com/weaviate/structured-rag) | 110 | Structured RAG experiments emphasizing JSON-constrained outputs and schema validation. | Borrow its structured RAG patterns and combine them with DSPy's retrievers and assertions to enforce response formats in production agents. |

## How to Contribute Back

1. **Evaluate fit:** Clone promising repositories locally and spike integrations inside `examples/` or `notebooks/` branches before upstreaming.
2. **Document learnings:** When a tool proves useful, add short integration guides or code snippets under `docs/docs/tutorials` so others can reproduce the setup.
3. **Share adapters:** For SDKs like Langwatch or Cognify, consider publishing lightweight wrappers inside `dspy/` and open a pull request to this repo. Reference this page so reviewers understand the ecosystem context.
4. **Stay current:** Re-run the GitHub search queries periodically (`topic:dspy` and `dspy language model`) to discover newcomers, then submit PRs updating star counts or adding noteworthy projects.

By tracking the broader DSPy ecosystem, we can accelerate the journey from research prototypes to production-ready language model systems.
