import json
from pathlib import Path

CONTRACTS = {
    "go_mode_response": {
        "schema_path": "contracts/go_mode_response.schema.json",
        "system_prompt": (
            "You are operating in GO MODE.\n"
            "Return ONLY valid JSON matching the GO MODE RESPONSE schema.\n"
            "No markdown. No extra keys. Include 2-3 likely follow-ups.\n"
        ),
    },
    "go_mode_code": {
        "schema_path": "contracts/go_mode_code.schema.json",
        "system_prompt": (
            "You are operating in GO MODE (BUILD VARIANT).\n"
            "Return ONLY valid JSON matching the GO MODE CODE schema.\n"
            "No markdown. No extra keys. Include a `deliverable` with file contents.\n"
            "If you propose code, include it under deliverable.files[].content.\n"
        ),
    },
}


def load_schema(contract_id: str) -> dict:
    if contract_id not in CONTRACTS:
        raise ValueError(f"Unknown contract_id: {contract_id}")
    path = Path(CONTRACTS[contract_id]["schema_path"])
    return json.loads(path.read_text(encoding="utf-8"))


def system_prompt_for(contract_id: str) -> str:
    if contract_id not in CONTRACTS:
        raise ValueError(f"Unknown contract_id: {contract_id}")
    return CONTRACTS[contract_id]["system_prompt"]
