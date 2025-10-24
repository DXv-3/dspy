# Event Pipeline & Real-Time Actions

The event pipeline translates every vault interaction into immediate downstream actions across summarization, embedding, notifications, and distributed automations. This guide specifies the event schema, agent responsibilities, and mesh deployment patterns required to keep the ecosystem responsive, observable, and extensible as new integrations join the network.

## Event-Driven Objectives

### Real-Time Response Goals

Event delivery must feel instantaneous to end users and dependent agents. Target sub-second publication from vault writes to NATS, millisecond fan-out inside the mesh, and under ten seconds for downstream actions such as summary generation or notifications. Every event includes the actor, operation, and resource metadata so that recipient agents can enforce policy, billing, or human-in-the-loop routing without additional round trips.

### Reliability & Safety Targets

The pipeline is treated as a tier-one service. NATS or equivalent pub/sub platforms run in clustered mode with persistence or streaming enabled, and publishers employ at-least-once semantics. Downstream consumers must deduplicate based on file path plus SHA-256, while automated guardrails reject or quarantine events that fail integrity checks, ensuring that only validated payloads reach human channels or premium workflows.

## Core Event Topologies

### Vault Mutation Topic

The `vault.file.saved` and `vault.file.appended` topics broadcast every mutation with absolute path, relative vault path, SHA-256 digest, tags, and event timestamp. These events are the canonical source for summarization, embedding, vector index updates, and cross-tenant synchronization. Additional metadata, such as project identifiers or entitlement tiers, enables agents to branch their workflows without re-reading the original file until necessary.

### Derived Artifact Topic

Summarization and research agents emit `vault.summary.created`, `vault.embedding.generated`, and `vault.research.completed` events once they finish processing a vault mutation. Each payload references the originating mutation event ID and includes quality scores, token usage, and optional human review flags. Downstream nodes use these events to trigger publishing, compliance checks, or multi-channel delivery without rescanning the vault.

### Notification & Integration Topic

A dedicated `notifications.dispatch` topic fans out templated messages toward Slack, Discord, email, SMS, PagerDuty, or webhook endpoints. Notification agents translate structured payloads into channel-specific formats, apply rate limiting, and record delivery receipts back to the vault. Administrators can subscribe audit dashboards to this topic to maintain a real-time feed of high-value updates.

### Control & Admin Topic

The `orchestration.control` topic coordinates mesh health, back-pressure, and override commands. Operators issue pause, resume, or reroute actions that downstream agents honor before processing the next batch. The same topic carries heartbeat, lag metrics, and deployment version metadata so observability stacks can alert on drift or stalled consumers.

## End-to-End Flow

### Save or Append Trigger

1. A vault client writes content through the MCP or AgentKit interface. Atomic file operations capture the new version and compute the SHA-256 digest.
2. The vault service publishes a `vault.file.saved` event containing path metadata, actor context, tags, and the digest. The event ID becomes the correlation key for all follow-on actions.
3. Summarization nodes subscribe with durable queues. They fetch the file, generate a BLUF-style summary, and emit `vault.summary.created` while persisting the summary alongside the source file.
4. Embedding workers pull the same event, compute dense embeddings for both the source and summary, and upsert records into the vector database. Completion results trigger `vault.embedding.generated` so search clusters and monitoring services update their caches.
5. Notification agents aggregate the payloads, build channel-specific messages, and publish `notifications.dispatch` followed by delivery status events to the vault or billing systems.
6. External webhooks, premium APIs, or browser automation runners subscribe to the relevant topics to launch follow-up workflows such as CRM updates, ticket creation, or scheduled reviews.

### Human-in-the-Loop Branches

If summarization confidence falls below a configured threshold or policy tags indicate sensitive content, the summarization agent emits a `vault.summary.pending_review` event instead. Human reviewers receive an actionable notification, approve or edit the draft, and the approval event resumes the normal `vault.summary.created` and embedding pipeline. This ensures that critical content remains accurate while keeping the overall flow responsive.

## Distributed Mesh Patterns

### Multi-Region NATS Federation

Large deployments run multiple NATS clusters or JetStream regions, connected through leaf nodes or mesh bridges. Vault events replicate across regions with replay protection, while local consumers handle summarization and embeddings using region-specific compute. Administrators define routing policies so latency-sensitive notifications remain local, whereas archival or analytics events forward to centralized data warehouses.

### Cross-Agent Propagation

AgentKit registries maintain the subscription roster for each agent. When new agents join (for example, a domain-specific classifier or billing auditor), they subscribe to the relevant topics with their own durable queues. Shared correlation IDs and consistent event schemas guarantee that each agent can trace the origin of a document, summary, or notification, enabling composable workflows without tight coupling.

### Failure Containment

Consumers enforce idempotency with digest caches and maintain retry queues for transient failures. If summarization or embedding services fail, the control topic broadcasts `orchestration.pause.summaries` or similar signals so upstream publishers temporarily buffer without dropping events. Observability dashboards surface lag metrics, enabling operators to scale the affected workers or reroute traffic to standby regions.

## Integration Targets & Automations

### Slack, Discord, and Webhooks

Notification agents map event payloads to channel-specific templates, including dynamic block-kit layouts for Slack or embed structures for Discord. Webhook integrations post JSON payloads with context, enabling downstream services like CRM, incident management, or workflow automation platforms to act immediately. Retries follow exponential backoff with signed payloads to prevent replay attacks.

### Vector Database Pipelines

Embedding workers batch inserts into Qdrant, Weaviate, Pinecone, or pgvector, attaching metadata such as project, author, summary quality, and related tasks. Downstream RAG services subscribe to `vault.embedding.generated` to refresh caches, pre-compute hybrid search indexes, or schedule evaluation runs that measure retrieval quality over time.

### Browser and Research Automations

Browser agents listen for tags indicating web actions (for example, `action:publish` or `action:monitor`). Upon receiving the event, they launch Playwright or Stagehand sessions to publish content, validate UI changes, or capture screenshots. Research agents monitor `vault.summary.created` to initiate deeper investigations, generating `vault.research.completed` with enriched context, citations, and recommended next steps.

## Monitoring & Administration

### Observability Stack

Telemetry collectors ingest metrics from NATS (subject throughput, consumer lag), summarization services (queue depth, token usage), embedding workers (batch latency), and notification agents (delivery success rate). Operators establish SLOs for each stage, with automated alerts when thresholds are breached. Structured logs tie every action back to the originating event ID, simplifying traceability.

Consult the [Deep Integration, Analytics, and Governance](./deep-integration-analytics-governance.md) guide for detailed collector configurations, dashboard patterns, and governance automations that extend these telemetry feeds into compliance programs.

### Admin Consoles

Administrative UIs expose live event streams, allow on-demand replays, and provide tooling to quarantine or redact specific documents. Dashboards highlight stalled consumers, failed notifications, or unusual surge patterns. Granular RBAC ensures only authorized operators can trigger reruns, purge events, or modify routing rules.

### Billing & Compliance Hooks

Billing agents consume every event type to compute usage metrics such as summaries generated, embeddings stored, or notifications sent. Compliance services maintain immutable audit logs, cross-referencing digests and timestamps to satisfy regulatory requirements. Automated policies can suspend notification fan-out or embedding updates when retention windows expire or legal holds are in effect.

## Implementation Playbook

### Minimum Viable Pipeline

1. Deploy the vault service with atomic writes and NATS publication for `vault.file.saved` and `vault.file.appended`.
2. Launch summarization and embedding workers with durable subscriptions, idempotent processing, and event emission for their outputs.
3. Add a notification agent that listens for summary completions and sends Slack or email updates, confirming delivery back into the vault.
4. Instrument the pipeline with metrics, logs, and dashboards to observe throughput, errors, and latency from event to action.

### Scaling the Mesh

1. Enable JetStream or similar persistence in NATS, configure clustering, and deploy cross-region leaf nodes to replicate subjects securely.
2. Introduce vector database sharding, caching layers, and streaming updates so RAG services scale with content volume.
3. Add dedicated webhook routers, CRM connectors, and browser automation pools that respond to domain-specific tags.
4. Extend admin tooling with replay controls, back-pressure configuration, and automated incident response playbooks tied to the control topic.

Following this blueprint ensures that every vault write immediately propagates through summaries, embeddings, notifications, and downstream automations while preserving observability, compliance, and scalability across a federated agentic ecosystem.
