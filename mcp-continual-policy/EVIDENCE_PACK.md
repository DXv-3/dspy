# Evidence Pack Appendix

## A. What we’re asserting (and why it’s not “vibes”)

**Claim A1 — “Optimal format depends on task + constraints”**

Why we believe it: OpenAI explicitly notes there are multiple prompt formats that work well and encourages exploring formats that fit the task.

Implementation hook: route requests to a contract (schema) based on task type.

---

**Claim A2 — “Prompts = instructions + context; structure matters”**

Why we believe it: Multiple sources converge on prompts as instructions + context and emphasize structure/clarity for output quality.

Implementation hook: MCP preflight: normalize context → pick schema → enforce output via validation.

---

**Claim A3 — “Iteration/validation is part of prompt engineering”**

Why we believe it: Prompting guidance commonly frames prompting as iterative and emphasizes validation of effectiveness.

Implementation hook: rejection sampling / retry on schema violations; canary + rollback for policy learning.

---

**Claim A4 — “Don’t trust the model; enforce with contracts”**

Why we believe it: Practical prompting guides emphasize robust interfacing with LLMs and tools; in production, that implies validation boundaries rather than trusting raw generations.

Implementation hook: jsonschema is the “hard edge” — model outputs are untrusted until validated.

## B. Evidence → Decisions Matrix

| Evidence | Design Decision | Concrete Mechanism |
| --- | --- | --- |
| “Explore formats that fit your task” | Multiple response contracts | Router → contract_id |
| Prompts are instructions + context; structure improves quality | Always include minimal context and explicit output constraints | Router builds system prompt + schema validation |
| Iteration matters | Retry on invalid outputs | MAX_RETRIES, “contract violation → retry” |
| Robust prompting in real systems | Zero-trust boundary around LLM | MCP validation gate |

## C. Appendix Snippet You Can Paste Into Your “One Big Doc”

**Evidence Pack Summary**

We treat “optimal format” as a function of task type + explicit constraints, consistent with OpenAI guidance that different prompt formats fit different tasks.
We operationalize this with a request router that selects a response contract (JSON schema) and enforces it via validation, reflecting common prompt-engineering fundamentals emphasizing structured instructions + context and iterative validation.
This is implemented as MCP authority: the model is untrusted until outputs pass schema validation.
