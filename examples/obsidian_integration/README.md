# Obsidian + DSPy Reference Integration

This example demonstrates how to connect an Obsidian plugin to a DSPy-powered FastAPI service that mixes large language model reasoning with both short- and long-term memory as well as OpenSearch retrieval. It combines every instruction from the original outline into a single document so you can stand up the whole system end to end without cross-referencing multiple sources.

## High-level architecture

* **DSPy backend service** – runs as a FastAPI app that exposes `/predict` and `/health`. It constructs a DSPy program, orchestrates model calls, and mediates access to memory stores and retrievers.
* **Memory providers** – pluggable adapters for `mem0` and `supermemory` that expose a unified `remember`/`recall` interface. They can be enabled or disabled per-request from the Obsidian plugin.
* **OpenSearch retriever** – a DSPy retriever implementation that queries an OpenSearch index populated with Obsidian note content and surfaces the top passages as additional context.
* **Obsidian plugin** – a TypeScript plugin that packages note context, toggles memory/retrieval flags, sends requests to the FastAPI backend, and renders responses inside a dockable view.

The boundaries are intentionally crisp so you can swap components: replace the LLM provider, point to a different vector store, or change the memory backend without rewriting the entire stack.

## Standing up DSPy

1. **Install the framework.** Use a virtual environment and install DSPy and backend dependencies via `uv sync` or `pip install -r requirements.txt`. The `server/requirements.txt` file pins FastAPI, uvicorn, OpenSearch, mem0, and supermemory helpers for convenience.
2. **Author a DSPy program.** The included `dsp_program.py` demonstrates a simple module that accepts `context`, `memories`, and `retrievals` arguments. Update `build_program()` to register your preferred language model (for example `dspy.LM("openai/gpt-4o-mini")`) and to modify the prompt or reasoning style.
3. **Expose an API.** `server/main.py` wraps the DSPy program behind FastAPI, adds optional bearer-token enforcement, and handles memory/retrieval plumbing. The `/predict` endpoint is synchronous by default; wrap `program` calls in `dspy.asyncify` if you plan to stream responses.
4. **Persist your program.** DSPy supports serialization of tuned programs. Add calls to `program.save()` or load precompiled programs during startup if you want warm caches when the plugin reconnects.

## Memory integration (mem0 & supermemory)

* Treat mem0 or supermemory as external modules. The `memories.py` file exposes `MemoryProvider` abstractions and two concrete implementations that normalise return types into `MemorySnippet` models so the API response stays consistent.
* When `include_memory` is enabled, `main.py` loads active providers, calls `provider.recall(note_path)`, and appends the results to the DSPy prompt as supplemental context. After generating a response the program calls `provider.remember(note_path, output_text)` to capture new data.
* If you prefer different responsibilities (e.g., mem0 for short-term conversations and supermemory for embeddings), adjust the ordering or filtering logic in `active_memory_providers()`.
* Each provider is optional: if an API key is missing the adapter is skipped. As soon as you supply credentials the provider becomes active without further code changes.

## OpenSearch retrieval

1. **Implement a retriever.** `server/opensearch_rm.py` provides `OpenSearchRM`, a `dspy.Retrieve` subclass that issues OpenSearch queries, converts hits into `dspy.Example` objects, and preserves metadata and scores.
2. **Configure DSPy.** The retriever is registered via `dspy.settings.configure` inside `dsp_program.py`. Adjust parameters such as `index`, `top_k`, or query template in `OpenSearchRM` to match your deployment.
3. **Index Obsidian notes.** Use `server/index_notes.py` to ingest markdown files. It walks a vault directory, parses YAML front matter with PyYAML, and writes each document to OpenSearch with the correct metadata.
4. **Tune relevance.** Experiment with analyzers, embeddings, or rerankers by editing the `OpenSearchRM.forward()` implementation. The retriever is isolated so you can adopt OpenSearch Hybrid Search or custom embedding pipelines without touching the rest of the backend.

## Obsidian wiring

* **Plugin call-out.** The TypeScript plugin in `plugin/src/` captures the active editor selection, the note path, and user settings. It posts a `PredictRequest` via `api.ts` using Axios and renders the response in a dockable panel.
* **Authentication.** The plugin exposes settings for the backend URL and optional bearer token. When configured, the token is attached as `Authorization: Bearer ...` to satisfy the FastAPI dependency.
* **Context control.** Users toggle whether to include memories and retrieval hits via persistent settings stored in `data.json`.
* **Response rendering.** Responses, recalled memories, and retrieval hits are concatenated in a read-only textarea so writers can trace provenance.

## Operational tips

* **Version control.** Keep both the backend and plugin in the same repository (as shown here) so you can evolve them together and reuse CI workflows.
* **Monitoring & logging.** Add structured logging or tracing hooks around memory provider calls and OpenSearch queries to capture latency and failure statistics.
* **Iterative tuning.** Start with the provided DSPy prompt, validate the Obsidian workflow, then iterate by adding programmatic guidance, multi-step modules, or retrieval-augmented generation as needed.
* **Security.** Set `app.api_key` inside `settings.toml` to require bearer tokens. Combine this with HTTPS termination (e.g., via Caddy or nginx) when deploying beyond localhost.
* **Deployments.** Containerize the FastAPI app with Uvicorn/Gunicorn for production and host it near your OpenSearch cluster to reduce latency. The plugin only needs the base URL and token to connect.

## Quickstart

1. Install Python dependencies:

   ```bash
   cd server
   uv sync  # or: pip install -r requirements.txt
   ```

2. Configure your API keys (for the LLM, mem0, supermemory, and OpenSearch) by editing `server/settings.toml` or by exporting matching environment variables (see `server/config.py`). Set `app.api_key` if you want the FastAPI service to require a bearer token (the plugin exposes a matching field under settings).

3. Populate OpenSearch with your Obsidian notes:

   ```bash
   cd server
   python index_notes.py /path/to/your/vault
   ```

   The helper script parses front matter metadata (when present) and pushes each markdown file into the index configured in `settings.toml`.

4. Start the backend server:

   ```bash
   uvicorn main:app --reload
   ```

5. In another terminal, install the plugin dependencies and build the plugin:

   ```bash
   cd plugin
   npm install
   npm run build
   ```

6. Copy the `plugin/` folder (or symlink it) into your Obsidian vault's `.obsidian/plugins/` directory and enable the plugin from Obsidian's community plugins tab.

Once everything is running you can select text inside an Obsidian note, press the command palette entry "DSPy: Predict with Memory", and the generated response will appear inside a dockable pane. The panel also lists recalled memories and retrieved passages (when enabled) so you can audit model behaviour.

## File layout

```
examples/obsidian_integration/
├── README.md
├── server/
│   ├── config.py
│   ├── dsp_program.py
│   ├── index_notes.py
│   ├── main.py
│   ├── memories.py
│   ├── opensearch_rm.py
│   ├── requirements.txt
│   ├── schemas.py
│   └── settings.toml
└── plugin/
    ├── manifest.json
    ├── package.json
    ├── rollup.config.mjs
    ├── src/
    │   ├── api.ts
    │   └── main.ts
    ├── styles.css
    └── tsconfig.json
```

Each backend module is documented inline so you can adapt it to your infrastructure, and this README centralises every architectural decision and operational guideline from the original discussion for quick reference.

## Configuration reference

The backend reads values from `settings.toml` (or matching environment variables) using `server/config.py`:

| Key | Description |
| --- | --- |
| `llm.provider` | Controls which LLM DSPy loads. Point this at OpenAI, Anthropic, or a local model server. |
| `llm.temperature` | Temperature passed to the selected LLM. |
| `memories.mem0_api_key` / `memories.supermemory_api_key` | API keys for each memory provider. Leave blank to disable a provider. |
| `memories.namespace` | Logical namespace used when storing and searching memories. |
| `opensearch.host` | URL to your OpenSearch cluster. |
| `opensearch.index` | Index that stores Obsidian documents. Must match the index used by `index_notes.py`. |
| `opensearch.verify_certs` | Toggle TLS verification when connecting to OpenSearch. |
| `app.allow_cross_origin` | Whether CORS is enabled for the FastAPI app. |
| `app.api_key` | Optional bearer token required by the FastAPI dependency. Leave empty for local development. |

Export environment variables such as `DSPY_OBSIDIAN_APP_API_KEY="secret"` to override values without editing the file. Nested keys follow the `DSPY_OBSIDIAN_<SECTION>_<FIELD>` pattern shown in `config.py` (for example, `DSPY_OBSIDIAN_LLM_PROVIDER`, `DSPY_OBSIDIAN_MEMORIES_MEM0_API_KEY`).

## API surface

* `GET /health` – returns `{ "status": "ok" }` when the service is ready. Useful for Obsidian plugin diagnostics and deployment health checks.
* `POST /predict` – accepts a JSON payload matching `PredictRequest`:

  ```json
  {
    "prompt": "string",
    "note_path": "relative/path/to/note.md",
    "include_memory": true,
    "include_retrieval": true
  }
  ```

  and returns `PredictResponse` with the model output, recalled memories, retrieval hits, and the raw DSPy program dictionary.

* `POST /predict/stream` – identical payload to `/predict` but responds with Server-Sent Events so the client can render partial completions while DSPy finishes the reasoning step. Events arrive in three shapes: `metadata` (initial memories/retrievals snapshot), repeated `chunk` messages with text deltas, and a terminal `complete` event containing the full `PredictResponse` payload.

Authentication is optional. When `app.api_key` is set you must send `Authorization: Bearer <token>` headers; otherwise requests are accepted without credentials.

## Plugin commands & settings

* **DSPy: Predict with Memory** – captures the current selection (or the whole note) and opens the response pane. When streaming is enabled the view updates as chunks arrive over SSE.
* **Settings panel** – exposes backend URL, bearer token, default include-memory flag, default include-retrieval flag, and the new streaming toggle. Values are stored via Obsidian’s `PluginSettingTab` utilities.

The plugin ships with Rollup configuration and TypeScript types so you can extend it—for example, add commands for summarising entire folders or automatically saving responses into notes.

## Indexing CLI

`python index_notes.py /path/to/vault` walks the provided directory, parses front matter, and writes each note to OpenSearch. Re-run the command whenever notes change, or wire it into Obsidian’s local REST API to trigger incremental updates.

Key behaviours:

* Front matter is parsed with PyYAML and merged into the document metadata.
* File modification time is stored so you can implement upserts or staleness checks later.
* The script reads `settings.toml` so you can reuse the same configuration for background workers.

## Next steps

* Expand the streaming pipeline to surface token-level attribution (e.g., highlight which retrieval snippet informed each chunk) or to expose a running log in the Obsidian UI.
* Integrate analytics by forwarding request/response payloads to your telemetry provider with user consent.
* Build automated tests that compile the plugin, run the backend under uvicorn, and verify `/predict` responses using mocked memory providers and a temporary OpenSearch container.

## Competitive research: Claude Memory and roadmap alignment

Anthropic’s latest Claude release introduced a persistent memory layer that synthesises daily summaries, keeps per-project context silos, surfaces citations back to prior chats, and lets users import/export memories across assistants. The release cadence shows memory expanding from Team to Enterprise plans alongside new tooling for incognito sessions and organisation-wide controls, signalling that customers expect granular governance over what the assistant retains. These behaviours map cleanly onto the toggles, namespaces, and provider abstractions in this example—use them as design checkpoints when extending DSPy flows or Obsidian UX for long-lived projects.

## Memory sync CLI

The `server/memory_sync.py` helper adds a lightweight bridge for migrating conversation history between Claude-style exports and your configured providers. It normalises JSON files with `text`/`summary` fields into `MemorySnippet` objects, pushes them through any active adapters (mem0, supermemory, or future providers), and can export retrieved snippets back to disk for audits or cross-tool sharing.

Typical usage:

```bash
cd examples/obsidian_integration/server
# Import a Claude memory export into both providers
python memory_sync.py import ~/Downloads/claude_memory.json --provider mem0 --provider supermemory

# Export the merged memories for a specific note path
python memory_sync.py export ./backups/note.json --note-path work/project-alpha.md
```

Because the CLI relies on the same credential checks as the FastAPI app, it automatically respects whichever providers are configured in `settings.toml`. This makes it easy to script nightly imports from other assistants or to snapshot the context you are about to share with collaborators.

## Additional ecosystem references

* [mem0](https://github.com/mem0ai/mem0) remains a rapidly evolving universal memory layer, complete with the new OpenMemory MCP for local-first deployments and an active release train you can track on GitHub. Align your adapters with their namespaces and document schemas so the Obsidian workflow inherits new capabilities without code churn.
