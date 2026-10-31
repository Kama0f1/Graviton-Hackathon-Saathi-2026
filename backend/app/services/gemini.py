"""The one door to Gemini: files + prompt + Pydantic schema -> validated object."""
import asyncio
import logging
from typing import Optional, Sequence, Tuple, Type, TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel

from ..config import GEMINI_API_KEY, GEMINI_MODEL
from .errors import AIError

log = logging.getLogger("saathi.gemini")
T = TypeVar("T", bound=BaseModel)
_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise AIError("GEMINI_API_KEY is not set in backend/.env")
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def _explain(exc: Exception) -> str:
    """Turn low-level errors into something a human can act on."""
    text = f"{type(exc).__name__}: {exc}".strip()
    if "getaddrinfo" in text or "ConnectError" in text or "ReadError" in text or "ConnectTimeout" in text:
        return "can't reach Google's servers (check internet / Wi-Fi; " + text + ")"
    if "API_KEY_INVALID" in text or "401" in text or "PERMISSION_DENIED" in text or "403" in text:
        return "Google rejected the API key (" + text[:300] + ")"
    if "429" in text or "RESOURCE_EXHAUSTED" in text:
        return "rate limit / quota hit, wait a minute (" + text[:300] + ")"
    if "404" in text or "NOT_FOUND" in text:
        return "model name not found, check GEMINI_MODEL in .env (" + text[:300] + ")"
    return text[:500]


async def ask(
    prompt: str,
    schema: Type[T],
    files: Sequence[Tuple[bytes, str]] = (),
    model: Optional[str] = None,
    timeout: float = 25.0,
    fallback: bool = True,
) -> T:
    """Send (bytes, mime_type) files + prompt; the AI must answer in `schema`'s JSON shape.
    Gemini first; if it fails or times out and GROQ_API_KEY is set, Groq answers instead (images only)."""
    try:
        return await _ask_gemini(prompt, schema, files, model, timeout)
    except AIError as exc:
        from . import groq  # local import keeps tests simple

        if not fallback or not groq.available(files) or "GEMINI_API_KEY is not set" in str(exc) and not groq.GROQ_API_KEY:
            raise
        log.warning("Gemini failed (%s); trying Groq backup", exc)
        try:
            return await groq.ask(prompt, schema, files)
        except AIError as exc2:
            log.warning("Groq backup failed too: %s", exc2)
            raise exc from exc2


async def _ask_gemini(prompt, schema, files, model, timeout):
    parts = [types.Part.from_bytes(data=data, mime_type=mime) for data, mime in files]
    try:
        resp = await asyncio.wait_for(
            _get_client().aio.models.generate_content(
                model=model or GEMINI_MODEL,
                contents=[*parts, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0,
                ),
            ),
            timeout=timeout,
        )
    except AIError:
        raise
    except asyncio.TimeoutError as exc:
        log.warning("Gemini took longer than %.0f s", timeout)
        raise AIError(f"Gemini took too long (over {timeout:.0f} s)") from exc
    except Exception as exc:  # network, quota, bad key ...
        reason = _explain(exc)
        log.warning("Gemini call failed: %s", reason)
        raise AIError(f"Gemini call failed: {reason}") from exc

    parsed = getattr(resp, "parsed", None)
    if isinstance(parsed, schema):
        return parsed
    if not resp.text:
        raise AIError("Gemini returned an empty response")
    try:
        return schema.model_validate_json(resp.text)
    except Exception as exc:
        log.error("Gemini JSON did not match %s: %s", schema.__name__, resp.text[:500])
        raise AIError("Gemini returned JSON in the wrong shape") from exc
