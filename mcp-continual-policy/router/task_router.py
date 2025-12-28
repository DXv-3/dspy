from dataclasses import dataclass


@dataclass(frozen=True)
class Route:
    task_type: str
    contract_id: str


def classify(user_query: str) -> Route:
    q = (user_query or "").strip().lower()

    if any(
        k in q
        for k in [
            "build",
            "implement",
            "full",
            "nitty-gritty",
            "every file",
            "repo",
            "wire",
            "module",
            "server",
            "mcp",
        ]
    ):
        return Route(task_type="build", contract_id="go_mode_code")

    if any(k in q for k in ["compare", "vs", "pros", "cons", "tradeoff", "which", "better", "should i"]):
        return Route(task_type="decision", contract_id="go_mode_response")

    if any(k in q for k in ["cite", "sources", "evidence", "paper", "study", "latest", "news"]):
        return Route(task_type="research", contract_id="go_mode_response")

    return Route(task_type="analysis", contract_id="go_mode_response")
