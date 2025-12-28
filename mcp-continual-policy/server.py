import json

from fastapi import FastAPI
from jsonschema import validate

from router.task_router import classify
from router.contracts import load_schema, system_prompt_for
from router.prompts import build_user_prompt

from eval.run_tests import run_unit_tests
from eval.judge import judge_solution
from optimizer.extract_rules import propose_new_rules
from optimizer.validate_rules import validate_rules
from utils.versioning import commit_policy, get_latest_policy_path, rollback_to
from utils.scoring import score_policy_update

app = FastAPI()

# Load fixed schemas once
with open("contracts/judge_output.schema.json", "r", encoding="utf-8") as handle:
    JUDGE_SCHEMA = json.load(handle)

with open("contracts/policy_diff.schema.json", "r", encoding="utf-8") as handle:
    DIFF_SCHEMA = json.load(handle)


def llm_call(system_prompt: str, user_prompt: str) -> dict:
    """
    Implement for your provider. Must return a dict (already parsed JSON).
    """
    raise NotImplementedError("Implement llm_call() for your model provider.")


@app.post("/route_and_respond")
def route_and_respond(payload: dict):
    user_query = payload["user_query"]
    context = payload.get("context", "")

    route = classify(user_query)
    schema = load_schema(route.contract_id)
    sys_prompt = system_prompt_for(route.contract_id)
    user_prompt = build_user_prompt(user_query, context, route.task_type)

    max_retries = 2
    last_err = None

    for _ in range(max_retries + 1):
        raw = llm_call(system_prompt=sys_prompt, user_prompt=user_prompt)
        try:
            validate(instance=raw, schema=schema)
            return {
                "route": {
                    "task_type": route.task_type,
                    "contract_id": route.contract_id,
                },
                "output": raw,
            }
        except Exception as exc:
            last_err = str(exc)

    return {
        "route": {
            "task_type": route.task_type,
            "contract_id": route.contract_id,
        },
        "error": "CONTRACT_VIOLATION",
        "details": last_err,
    }


@app.post("/respond_go_mode")
def respond_go_mode(payload: dict):
    """
    Backward-compatible: always uses go_mode_response.
    """
    user_query = payload["user_query"]
    context = payload.get("context", "")

    schema = load_schema("go_mode_response")
    sys_prompt = system_prompt_for("go_mode_response")
    user_prompt = build_user_prompt(user_query, context, "analysis")

    raw = llm_call(system_prompt=sys_prompt, user_prompt=user_prompt)
    validate(instance=raw, schema=schema)
    return raw


@app.post("/solve_and_learn")
def solve_and_learn(payload: dict):
    problem = payload["problem"]
    repo_path = payload["repo_path"]
    reference_solution = payload["reference_solution"]

    with open("registry/policies/base.md", "r", encoding="utf-8") as handle:
        base_policy = handle.read()

    learned_policy_path = get_latest_policy_path()
    learned_policy = (
        open(learned_policy_path, "r", encoding="utf-8").read()
        if learned_policy_path
        else ""
    )

    with open("agents/coder.md", "r", encoding="utf-8") as handle:
        coder_prompt = handle.read()

    system_prompt = (
        coder_prompt
        .replace("{{BASE_POLICY}}", base_policy)
        .replace("{{LEARNED_POLICY}}", learned_policy)
        .replace("{{PROBLEM}}", problem)
    )

    solution = llm_call(system_prompt=system_prompt, user_prompt=problem)
    tests = run_unit_tests(repo_path)

    judge_out = judge_solution(
        problem,
        json.dumps(solution),
        tests,
        reference_solution,
        llm_call,
        JUDGE_SCHEMA,
    )

    committed_path = None
    update_score = None

    if judge_out["verdict"] == "fail":
        new_rules = propose_new_rules(learned_policy, judge_out, llm_call, DIFF_SCHEMA)
        validate_rules(new_rules)
        update_score = score_policy_update(judge_out, new_rules)

        if update_score >= 1.0:
            committed_path = commit_policy(new_rules)

    return {
        "solution": solution,
        "tests": tests,
        "judge": judge_out,
        "policy_committed": committed_path,
        "policy_update_score": update_score,
    }


@app.post("/get_policy_latest")
def get_policy_latest(_: dict):
    path = get_latest_policy_path()
    return {
        "path": path,
        "policy": open(path, "r", encoding="utf-8").read(),
    }


@app.post("/rollback_policy")
def rollback_policy(payload: dict):
    idx = payload["version_index"]
    path = rollback_to(idx)
    return {
        "rolled_back_to": idx,
        "path": path,
        "policy": open(path, "r", encoding="utf-8").read(),
    }
