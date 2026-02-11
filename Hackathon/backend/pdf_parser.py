import json
from pypdf import PdfReader
from llm import llm_response, LLMError

def parse_pdf(pdf_path: str) -> dict:
    # Extract raw text from PDF
    reader = PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text() + "\n"

    # Send to LLM to structure it
    prompt = f"""
You are a lab manual parser.
Extract the following from the lab manual text and return ONLY valid JSON, no explanation, no markdown.

Use EXACTLY this format:
{{
  "experiment_metadata": {{
    "experiment_id": int,
    "title": string,
    "objective": string
  }},
  "materials_required": {{
    "apparatus": [list of strings],
    "chemicals": [
      {{
        "name": string,
        "concentration": string
      }}
    ]
  }},
  "procedure": [
    {{
      "step_number": int,
      "instruction": string,
      "expected_outcome": string
    }}
  ],
  "precautions": [list of strings]
}}

LAB MANUAL TEXT:
{full_text}
"""

    try:
        response = llm_response(prompt)
    except LLMError as e:
        raise e
    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        raise LLMError(
            "Lab manual parser got invalid JSON from Gemini (often due to rate limit or empty response). "
            "Try again in a few minutes."
        ) from e