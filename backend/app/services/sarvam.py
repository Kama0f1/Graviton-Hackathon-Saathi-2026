"""Sarvam text-to-speech for Indian-language voices. Returns WAV bytes.
Docs: https://docs.sarvam.ai/api-reference-docs/text-to-speech/convert"""
import base64
import logging

import httpx

from ..config import SARVAM_API_KEY, SARVAM_SPEAKER, SARVAM_TTS_MODEL
from .errors import AIError
from .prompts import lang_code

log = logging.getLogger("saathi.sarvam")
URL = "https://api.sarvam.ai/text-to-speech"
LANGS = {"en": "en-IN", "hi": "hi-IN", "pa": "pa-IN"}
MAX_CHARS = 2500  # bulbul:v3 limit (v2 is 1500)


async def speak(text: str, lang: str = "en") -> bytes:
    if not SARVAM_API_KEY:
        raise AIError("SARVAM_API_KEY is not set in backend/.env")
    payload = {
        "text": text[:MAX_CHARS],
        "language_code": LANGS[lang_code(lang)],
        "model": SARVAM_TTS_MODEL,
        "speaker": SARVAM_SPEAKER,
    }
    headers = {"api-subscription-key": SARVAM_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(URL, json=payload, headers=headers)
            if resp.status_code in (400, 422):
                # older API versions named the field target_language_code
                payload["target_language_code"] = payload.pop("language_code")
                resp = await client.post(URL, json=payload, headers=headers)
            resp.raise_for_status()
            audios = resp.json().get("audios") or []
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        hint = "Sarvam rejected the API key" if code in (401, 403) else f"Sarvam returned HTTP {code}"
        log.warning("%s: %s", hint, exc.response.text[:300])
        raise AIError(f"{hint}: {exc.response.text[:300]}") from exc
    except httpx.HTTPError as exc:
        reason = f"can't reach Sarvam's servers (check internet / Wi-Fi; {type(exc).__name__}: {exc})"
        log.warning("Sarvam TTS failed: %s", reason)
        raise AIError(f"Sarvam TTS failed: {reason}") from exc
    if not audios:
        raise AIError("Sarvam returned no audio")
    return base64.b64decode(audios[0])
