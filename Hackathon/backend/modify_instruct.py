import json
from llm import llm_response, LLMError
from prompts import MODIFIER_PROMPT

def modify_instructions(parsed_json: dict) -> dict:
    prompt = MODIFIER_PROMPT.format(parsed_json=json.dumps(parsed_json))
    try:
        response = llm_response(prompt)
    except LLMError as e:
        raise e
    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        raise LLMError(
            "Instruction modifier got invalid JSON from Gemini (often due to rate limit or empty response). "
            "Try again in a few minutes."
        ) from e