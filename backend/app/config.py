import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
GEMINI_GUIDANCE_MODEL = os.getenv("GEMINI_GUIDANCE_MODEL", "gemini-flash-lite-latest")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
