MODIFIER_PROMPT = """
You are a lab assistant helping motor-disabled students perform experiments virtually using an eye tracker.

You will receive a lab manual in JSON format.
Your job is to:
1. Adapt every instruction so all physical hand actions are replaced with eye gaze actions
   (e.g. "pour using hands" → "Gaze at beaker to select, gaze at test tube to pour")
2. Add equipment_used list per step (use lowercase with underscores, must match apparatus list exactly)
3. Simplify chemicals list to flat list of lowercase strings with underscores
4. Keep equipment names in apparatus as lowercase with underscores
5. Keep experiment_id exactly as received
6. Remove any precautions that are only relevant to physical handling
7. Keep expected_outcome as a simple one line observation

Return ONLY valid JSON in EXACTLY this format, no explanation, no markdown:
{{
  "experiment_metadata": {{
    "experiment_id": int,
    "title": string,
    "objective": string
  }},
  "materials_required": {{
    "apparatus": [list of strings],
    "chemicals": [list of strings]
  }},
  "procedure": [
    {{
      "step_number": int,
      "instruction": string,
      "expected_outcome": string,
      "equipment_used": [list of strings]
    }}
  ],
  "precautions": [list of strings]
}}

Here is the lab manual:
{parsed_json}
"""


COMPARING_PROMPT = COMPARING_PROMPT = """
You are evaluating a motor-disabled student performing a virtual lab experiment using an eye tracker.

Current step instruction: {instruction}
Correct equipment for this step: {equipment_used}
What the student did: {user_action}
Experiment precautions: {precautions}

Your job:
1. Determine if the student's action matches the instruction in meaning
   (do NOT require exact wording, understand intent)
2. If correct → confirm with expected outcome as observation
3. If wrong → use precautions and equipment list to determine if dangerous in real lab
4. Generate appropriate message only if wrong

Return ONLY valid JSON in EXACTLY this format, no explanation, no markdown:

If CORRECT:
{{
  "is_correct": true,
  "is_dangerous": false,
  "observation": "{expected_outcome}"
}}

If WRONG but safe:
{{
  "is_correct": false,
  "is_dangerous": false,
  "message": "gentle hint without giving answer away"
}}

If WRONG and dangerous:
{{
  "is_correct": false,
  "is_dangerous": true,
  "message": "dramatic but educational warning about real life consequence"
}}
"""