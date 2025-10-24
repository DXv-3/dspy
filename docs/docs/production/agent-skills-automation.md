# Agent Skills, Automation, and Interactions

A production-grade agentic ecosystem depends on a catalog of specialized agents, well-defined skills, and repeatable orchestration patterns. This guide enumerates the primary agent types, the workflows they execute, and the escalation paths that keep humans informed while unlocking premium product experiences.

## Agent Catalog and Core Skills

### Browser Operations Agent

- Executes deterministic or heuristic UI sequences across SaaS products using Playwright, Stagehand, or Selenium runners.
- Captures DOM snapshots, accessibility trees, cookies, and session state so downstream agents can replay or analyze actions.
- Publishes structured telemetry (actions taken, artifacts saved, retry counts) to the event bus with correlation IDs for observability.

### Research Intelligence Agent

- Batches search queries across Perplexity, internal retrieval endpoints, and knowledge bases with adaptive throttling.
- Normalizes citations, source metadata, and provenance tags before writing into the vault or vector index.
- Exposes "explain plan" and "ask follow-up" tools via AgentKit so other agents can extend research threads instead of restarting them.

### Summarization and Authoring Agent

- Listens to vault events (create, append, metadata updates) and generates briefings, changelogs, or BLUF summaries.
- Applies DSPy programs or LangChain prompts with tone, length, and formatting guardrails driven by customer tier.
- Routes outputs to notifications, billing, or indexers depending on workflow metadata supplied by upstream agents.

### Event Bus Responder

- Subscribes to NATS subjects for vault updates, browser completions, billing events, and system health signals.
- Transforms raw events into normalized envelopes (context, actor, downstream intents) so flows remain loosely coupled.
- Can escalate anomalies by invoking compliance checks, rate-limiters, or human approval interfaces when thresholds are crossed.

### Vector Indexer Agent

- Embeds raw documents and synthesized summaries using provider-specific embedding models per tenant or tier.
- Syncs metadata (source path, SHA, security tags) with Qdrant, Weaviate, or pgvector to support hybrid search and analytics.
- Maintains deduplication maps and TTL policies to control storage spend and honor customer retention requirements.

### Notification & Escalation Agent

- Crafts multi-channel updates (Slack, email, SMS, in-app) based on event payloads and user notification preferences.
- Applies quiet-hours, batching, and fallback channel policies so alerts are timely but not noisy.
- Surfaces human-in-the-loop approvals by embedding actionable buttons or deep links that re-enter the Apps SDK flows.

### Feedback & Evaluation Agent

- Collects explicit user ratings, comment threads, and auto-evaluations from LangSmith, OpenAI evals, or custom scorecards.
- Logs feedback into the vault with references to the triggering agent run for traceability.
- Re-triggers refinement workflows or model retraining pipelines when feedback falls below SLAs.

### Billing & Commercial Agent

- Aggregates usage metrics (tokens, automation minutes, storage, API costs) from the event bus and orchestrator logs.
- Computes entitlements for freemium, pro, and enterprise plans, issuing MCP-based entitlement updates.
- Integrates with Stripe, LemonSqueezy, or internal billing APIs to post invoices, handle proration, and sync revenue analytics.

## Workflow Patterns and Chaining

### Browser-to-Research Loop

1. LangGraph dispatches a `BrowserTask` with goal, credentials, and guardrails.
2. Browser agent executes actions, saving artifacts to the vault and emitting `browser.task.completed` with references.
3. Research agent consumes the event, enriching the captured pages with focused queries and writing consolidated research briefs.
4. Summarization agent produces a BLUF note, while the indexer embeds both raw and synthesized outputs.

### Research-to-Notification Escalation

1. Research agent finalizes a dossier and writes it to the vault.
2. Vault event triggers summarization, vectorization, and billing updates.
3. Notification agent maps metadata (severity, audience, subscription tier) to channel templates, sending targeted updates.
4. Humans respond through Apps SDK interactions that the feedback agent captures and circulates back to orchestrators.

### Event Bus Driven Automations

- Event responder filters NATS subjects and routes payloads to LangGraph branches (e.g., compliance check, billing audit, anomaly detection).
- Feedback agent injects human decisions by requesting approvals or clarifications through Apps SDK tasks.
- Premium tiers can enable additional responders—such as autonomous remediation or priority support agents—that execute parallel corrective workflows.

### Memory Context Sharing

- Vault orchestrator provides canonical storage with SHA digests, metadata tags, and contextual embeddings.
- Agents attach context references (`context_ids`, `related_paths`) to events so downstream tasks can hydrate full histories without redundant retrieval.
- Memory snapshots per project or tenant enable multi-tenant isolation while supporting cross-agent recall via shared keys or namespaces.

## Human-in-the-Loop Touchpoints

- Apps SDK cards surface live agent status, intermediate outputs, and approval requests.
- LangGraph embeds `HumanApproval` nodes with SLA timers; if approvals lapse, fallbacks trigger notifications or escalate to supervisors.
- Browser agents can hand off to human operators by capturing the current UI state and delivering step-by-step instructions through the dashboard.

## Premium and Marketplace Features

- Tiered entitlements unlock higher concurrency, advanced research sources, premium summarization styles, or enterprise compliance scans.
- Marketplace connectors expose third-party MCP tools that customers can install; billing agent tracks usage per connector for revenue sharing.
- Revenue operations agent reconciles marketplace purchases, agent usage, and subscription renewals, updating CRM or ERP systems.

## App Store and Distribution Logic

- AgentKit registry tags each agent with availability tiers, required permissions, and dependency metadata.
- Admins browse the in-app catalog, enabling agents per workspace; activation triggers deployment workflows and config templates.
- Usage analytics feed back into the marketplace to surface popular agents, upsell premium bundles, and recommend complementary automation packs.

By mapping every agent skill, workflow chain, and commercial touchpoint, teams can compose reliable automations that respect human oversight, share institutional memory, and monetize advanced capabilities across their agentic platform.
