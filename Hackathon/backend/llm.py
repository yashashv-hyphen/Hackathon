import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


class LLMError(Exception):
    """Raised when the LLM API fails (e.g. rate limit, quota, or invalid response)."""
    pass


def llm_response(prompt: str) -> str:
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        text = response.choices[0].message.content
        if text is None:
            raise LLMError("Groq returned no text.")
        text = text.strip()
        if not text:
            raise LLMError("Groq returned an empty response.")
        return text
    except LLMError:
        raise
    except Exception as e:
        msg = str(e).lower()
        if "429" in msg or "rate" in msg or "quota" in msg:
            raise LLMError(
                "Groq rate limit exceeded. Please wait a few minutes and try again."
            ) from e
        if "503" in msg or "unavailable" in msg:
            raise LLMError("Groq service temporarily unavailable. Try again shortly.") from e
        raise LLMError(f"Groq API error: {e}") from e