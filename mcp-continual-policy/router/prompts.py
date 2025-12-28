def build_user_prompt(user_query: str, context: str, route_task_type: str) -> str:
    return (
        f"TASK_TYPE: {route_task_type}\n"
        f"CONTEXT:\n{context or ''}\n\n"
        f"USER_QUERY:\n{user_query}\n"
    )
