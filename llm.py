import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

client=genai.Client(
    api_key=os.getenv("NEW_GEMINI_API_KEY")
)
def llm_response(prompt):
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    return response.text
