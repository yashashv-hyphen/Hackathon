import json
from llm import llm_response
from prompts import COMPARING_PROMPT

def compare_action(
    instruction: str,
    user_action: str,
    expected_outcome: str,
    equipment_used: list,
    precautions: list
) -> dict:

    prompt = COMPARING_PROMPT.format(
        instruction=instruction,
        user_action=user_action,
        expected_outcome=expected_outcome,
        equipment_used=equipment_used,
        precautions=precautions
    )

    response = llm_response(prompt)

    return json.loads(response)