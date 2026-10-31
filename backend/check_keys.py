"""Checks that the API keys in backend/.env actually work.
Run from backend/ (venv active):  python check_keys.py
Never prints the full key."""
import asyncio
import sys
import time

from app.config import GEMINI_API_KEY, GEMINI_GUIDANCE_MODEL, GEMINI_MODEL, GROQ_API_KEY, GROQ_MODEL, SARVAM_API_KEY
from app.schemas import SpeechOnly
from app.services import gemini, groq, sarvam
from app.services.errors import AIError


def mask(key: str) -> str:
    return f"{key[:3]}...{key[-4:]} ({len(key)} chars)" if key else "(empty)"


async def main() -> int:
    ok = True
    print("Gemini key:", mask(GEMINI_API_KEY))
    # warm-up call first, so connection setup isn't blamed on a model; then each model twice
    order = [GEMINI_GUIDANCE_MODEL] + [m for m in dict.fromkeys([GEMINI_MODEL, GEMINI_GUIDANCE_MODEL]) for _ in range(2)]
    for i, model in enumerate(order):
        if i == 0:
            print("  (warm-up call)")
        start = time.time()
        try:
            r = await gemini.ask('Set speech to exactly: "Saathi is working."', SpeechOnly, model=model)
            print(f"  [OK]   {model}: {r.speech!r} ({time.time() - start:.1f}s)")
        except AIError as exc:
            ok = False
            print(f"  [FAIL] {model}: {exc}")

    print("Groq key (backup):", mask(GROQ_API_KEY))
    if not GROQ_API_KEY:
        print("  [SKIP] no key set (optional backup if Gemini fails)")
    else:
        start = time.time()
        try:
            r = await groq.ask('Set speech to exactly: "Saathi is working."', SpeechOnly)
            print(f"  [OK]   {GROQ_MODEL}: {r.speech!r} ({time.time() - start:.1f}s)")
        except AIError as exc:
            ok = False
            print(f"  [FAIL] {exc}")

    print("Sarvam key:", mask(SARVAM_API_KEY))
    if not SARVAM_API_KEY:
        print("  [SKIP] no key set (optional, only for Hindi/Punjabi voice)")
    else:
        start = time.time()
        try:
            audio = await sarvam.speak("Namaste, Saathi is ready.", "hi")
            print(f"  [OK]   got {len(audio):,} bytes of audio ({time.time() - start:.1f}s)")
        except AIError as exc:
            ok = False
            print(f"  [FAIL] {exc}")

    print("\nAll good." if ok else "\nSomething failed. Check the [FAIL] lines above (the full key is never shown).")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
