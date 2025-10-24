# Technical Stack and Modular Build Plan

The technical stack and modular build plan translate the ecosystem vision into deployable services, wiring together the Model Context Protocol (MCP), AgentKit agents, LangGraph workflows, a NATS event bus, and the atomic vault so teams can deliver and operate the universal agentic platform described in the companion guides. This document outlines the service boundaries, implementation patterns, deployment artifacts, and operational safeguards needed to launch the stack with confidence.

## Service Topology and Contracts

### Core Services

- **MCP Orchestrator (FastAPI):** Normalizes tool schemas, enforces capability-based access, and streams status updates to Apps SDK surfaces.
- **AgentKit Runtime:** Hosts Python-based agents (browser, research, vault, notification, billing) with declarative tool definitions and guardrails.
- **LangGraph Workflows:** Compose deterministic multi-step plans using DSPy programs, agent tools, and policy branches.
- **Vault Memory Service:** Provides atomic file writes, append operations, frontmatter support, and deterministic digests for audit trails.
- **Event Bus (NATS):** Publishes `vault.file.saved`, agent lifecycle, and billing events that trigger downstream automations.
- **Vector Indexer:** Embeds raw documents and summaries, enabling RAG and semantic search.

### Supporting Modules

- **Notification Dispatchers:** Listens to NATS subjects and posts updates to Slack, email, or webhook targets.
- **Billing & Entitlement Services:** Records usage metrics, orchestrates subscription tiers, and reconciles third-party API spend.
- **Observability Stack:** Ships OpenTelemetry traces, metrics, and structured logs to your monitoring platform of choice. Pair this implementation guidance with the [Deep Integration, Analytics, and Governance](./deep-integration-analytics-governance.md) playbook to configure collectors, dashboards, and policy pipelines across environments.

## FastAPI MCP Orchestrator

### Project Layout

```
mcp/
├── main.py
├── routers/
│   ├── agents.py
│   └── health.py
├── models.py
└── requirements.txt
```

### Implementation Highlights

```python
# mcp/main.py
from fastapi import FastAPI, Depends
from fastapimcp import FastApiMCP

from routers import agents, health

app = FastAPI(title="Ecosystem MCP", version="1.0.0")
app.include_router(health.router)
app.include_router(agents.router)

mcp = FastApiMCP(app, server_url="http://mcp:8000")
```

- Each router exposes MCP tool handlers with validated request/response schemas. The MCP adapter wraps FastAPI endpoints, emits streaming status updates, and keeps parity with Apps SDK expectations.
- Dependency injection (e.g., `Depends(get_agent_registry)`) ensures every tool call uses signed credentials, policy checks, and rate limits.
- Background tasks publish structured events to NATS after every tool completion, including timing metadata for SLA tracking.

## AgentKit Runtime and Agent Definitions

### Agent Registry Pattern

```python
# agent_runtime/registry.py
import agentkit
from .tools import browser, research, vault, notifications

REGISTRY = agentkit.Registry()

@REGISTRY.agent(name="browser")
class BrowserAgent:
    @agentkit.tool
    async def run_playwright(self, script: str, context: dict):
        ...

@REGISTRY.agent(name="vault")
class VaultAgent:
    @agentkit.tool
    def save_document(self, path: str, content: str):
        ...
```

- The registry maps agent names to tool bundles, guardrails, and capability tags that the MCP server references when routing requests.
- Tools execute inside isolated sandboxes (Docker containers, VM sandboxes, or Stagehand sessions) to maintain zero-trust boundaries.
- Guardrails validate inbound parameters, sanitize prompts, and enforce allow-lists before any automation or external API call runs.

### Chaining and Escalation

- Agents return structured payloads (JSON or pydantic models) that include `status`, `artifacts`, and `next_actions`. LangGraph reads these outputs to determine whether to continue autonomously or escalate to a human review step.
- Custom AgentKit decorators can append audit metadata and automatically write the transcript to the vault for future retrieval.

## Event Bus and LangGraph Wiring

### Event Publication

```python
# shared/events.py
import os, json, asyncio
from nats.aio.client import Client as NATS

NATS_URL = os.getenv("NATS_URL", "nats://nats:4222")
SUBJECT = "vault.file.saved"

async def publish(payload: dict):
    nc = NATS()
    await nc.connect(servers=[NATS_URL])
    await nc.publish(SUBJECT, json.dumps(payload).encode("utf-8"))
    await nc.drain()
```

- Publishing occurs synchronously within the MCP completion hook for deterministic sequencing, but the NATS client should reuse connections via a singleton to avoid overhead under load.
- Events include SHA digests, actor IDs, and correlation tokens so downstream consumers can de-duplicate processing.

### LangGraph Subscriber

```python
# langgraph/workflows/vault_summary.py
from langgraph.graph import StateGraph, START, END
from .state import VaultState

workflow = StateGraph(VaultState)
workflow.add_node("load", load_document)
workflow.add_node("summarize", summarize_document)
workflow.add_node("persist", write_summary)
workflow.add_edge(START, "load")
workflow.add_edge("load", "summarize")
workflow.add_edge("summarize", "persist")
workflow.add_edge("persist", END)
```

- A lightweight async runner subscribes to `vault.file.saved`, invokes the compiled LangGraph workflow, and emits follow-up events (e.g., `vault.summary.generated`).
- Additional branches in the graph forward results to the vector indexer, notifications, or human review nodes based on metadata such as sensitivity labels.

## Atomic Vault Operations

### Write and Append Semantics

```python
# vault/main.py
from pathlib import Path
from filelock import FileLock
from contextlib import contextmanager
import hashlib, os

VAULT_PATH = Path(os.getenv("VAULT_PATH", "./vault")).resolve()

@contextmanager
def atomic_write(path: Path):
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    with open(tmp_path, "w", encoding="utf-8") as temp:
        yield temp
    os.replace(tmp_path, path)

def save(path: Path, content: str) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(path) + ".lock")
    with lock:
        with atomic_write(path) as handle:
            handle.write(content)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()
```

- `_safe_join` utilities ensure relative paths cannot escape `VAULT_PATH`. All read operations validate existence and enforce UTF-8 decoding with fallbacks for binary detection.
- Append operations re-read the file under lock, compute whether the new content already exists at EOF, and avoid duplicate writes when events are replayed.
- Every mutation publishes to NATS, updates the vector index, and records an audit line in the logging system.

## Modular Deployment with Docker Compose

### Directory Layout

```
compose/
├── docker-compose.yml
├── mcp/
│   └── Dockerfile
├── agent_runtime/
│   └── Dockerfile
├── langgraph/
│   └── Dockerfile
├── vault/
│   └── Dockerfile
└── docs/
    └── README.md
```

### Sample docker-compose.yml

```yaml
version: "3.9"
services:
  nats:
    image: nats:2
    ports:
      - "4222:4222"
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
  vault:
    build: ../vault
    environment:
      VAULT_PATH: /data
      NATS_URL: nats://nats:4222
    volumes:
      - vault-data:/data
  mcp:
    build: ../mcp
    environment:
      NATS_URL: nats://nats:4222
    depends_on:
      - nats
      - vault
  agent-runtime:
    build: ../agent_runtime
    environment:
      MCP_URL: http://mcp:8000
      VAULT_URL: http://vault:8080
    depends_on:
      - mcp
  langgraph:
    build: ../langgraph
    environment:
      NATS_URL: nats://nats:4222
      VAULT_PATH: /data
    volumes:
      - vault-data:/data
    depends_on:
      - nats
      - vault
volumes:
  vault-data:
```

- Each service exposes liveness endpoints (`/healthz`) consumed by Compose `healthcheck` directives in production setups.
- Secrets (API keys, database credentials) are injected via Docker secrets or cloud secret managers rather than environment variables in public repos.

## Advanced Operations and Reliability

### Security and Compliance

- Enforce mutual TLS between services using a service mesh (Istio, Linkerd, or Traefik with mTLS). Certificates rotate automatically through your platform.
- Integrate secrets management (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager) with AgentKit runtime to avoid embedding credentials in configuration files.
- Maintain RBAC and ABAC policies within the MCP server: each Apps SDK client receives scoped tokens that map to allowable tools and datasets.

### Snapshotting and Backups

- Schedule nightly snapshots of the vault volume (e.g., AWS EBS snapshot, filesystem `zfs send`, or `restic` backups). Include SHA digests and event logs to confirm consistency.
- Qdrant or vector store data is backed up using incremental export jobs and rehydrated during disaster recovery before agents resume processing.

### Logging, Metrics, and Alerting

- Standardize structured logging (JSON) with request IDs, correlation IDs, and user context for every tool invocation. Ship logs to ELK, Datadog, or CloudWatch.
- Emit OpenTelemetry traces from FastAPI, AgentKit, and LangGraph nodes. Include spans for external API calls, vault operations, and billing updates.
- Define SLOs (latency, success rate) per service and configure alerting rules in Prometheus, Grafana, or your cloud-native monitor.

### Idempotency and Replay Safety

- Use SHA digests and monotonic sequence numbers on every vault event. Consumers verify whether they have already processed an event before acting.
- LangGraph workflows persist state (e.g., Redis, Postgres) between steps so retries resume from the last successful node.
- MCP endpoints should implement optimistic concurrency using ETags or version headers when modifying shared resources (e.g., knowledge base entries or billing records).

### Developer Experience

- Provide `make up` and `make test` commands that wrap Docker Compose lifecycle and pytest runs. Developers can spin up the full stack locally with one command.
- Include VS Code devcontainer or GitHub Codespaces configuration pointing at the Compose stack for consistent tooling.
- Document common tasks (adding a new agent, extending LangGraph, upgrading the vector store) in `docs/production/recipes/` so new team members can ramp quickly.

## Next Steps

- Wire CI/CD pipelines that build container images, run unit and integration tests, and promote tagged releases into staging and production clusters.
- Add synthetic monitoring jobs that execute representative MCP workflows against staging to validate orchestration behavior after each deploy.
- Extend billing connectors with metering reports and marketplace-ready SKU definitions so partners can discover and purchase advanced agent bundles.
