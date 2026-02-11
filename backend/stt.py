import base64
import os
import tempfile
import whisper
import torch

MODEL_NAME = "base"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

model = whisper.load_model(MODEL_NAME, device=DEVICE)

def audio_to_text(base64_audio: str) -> str:
    if not base64_audio:
        return ""

    # Strip data URL prefix if present (e.g. "data:audio/wav;base64,")
    if "," in base64_audio:
        base64_audio = base64_audio.split(",")[1]

    # Fix base64 padding
    missing_padding = len(base64_audio) % 4
    if missing_padding:
        base64_audio += "=" * (4 - missing_padding)

    audio_bytes = base64.b64decode(base64_audio)

    # Save as webm (most browsers record in webm by default)
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        # transcribe() handles all formats + all the mel spectrogram stuff internally
        result = model.transcribe(tmp_path, fp16=(DEVICE == "cuda"))
        return result["text"].strip()

    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass