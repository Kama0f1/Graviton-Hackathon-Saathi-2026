import os

from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
GEMINI_GUIDANCE_MODEL = os.getenv("GEMINI_GUIDANCE_MODEL", "gemini-flash-lite-latest")

# optional backup AI, used only when Gemini fails or times out (images only, no PDFs)
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_TTS_MODEL = os.getenv("SARVAM_TTS_MODEL", "bulbul:v3")
SARVAM_SPEAKER = os.getenv("SARVAM_SPEAKER", "priya")

ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

MAX_UPLOAD_MB = float(os.getenv("MAX_UPLOAD_MB", "15"))
SESSION_TTL_HOURS = float(os.getenv("SESSION_TTL_HOURS", "6"))
