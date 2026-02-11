import json
from llm import llm_response
from prompts import MODIFIER_PROMPT

def modify_instructions(parsed_json: dict) -> dict:
    
    prompt = MODIFIER_PROMPT.format(parsed_json=json.dumps(parsed_json))
    
    response = llm_response(prompt)
    
    return json.loads(response)