"""Backup AI: Groq vision model (free tier), OpenAI-style chat API. Used only if Gemini fails.
Docs: https://console.groq.com/docs/vision  (images only: no PDFs, up to 3 images)"""
import base64
import json
import logging
import re
from typing import Sequence, Tuple, Type, TypeVar

import httpx
from pydantic import BaseModel

from ..config import GROQ_API_KEY, GROQ_MODEL
from .errors import AIError

log = logging.getLogger("saathi.groq")
URL = "https://api.groq.com/openai/v1/chat/completions"
T = TypeVar("T", bound=BaseModel)


def available(files: Sequence[Tuple[bytes, str]]) -> bool:
    return bool(GROQ_API_KEY) and len(files) <= 3 and all(m.startswith("image/") for _, m in files)


def _json_from(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()  # drop reasoning, if any
    start, end = text.find("{"), text.rfind("}")
    return text[start:end + 1] if start != -1 and end > start else text


async def ask(prompt: str, schema: Type[T], files: Sequence[Tuple[bytes, str]] = (), timeout: float = 20.0) -> T:
    if not GROQ_API_KEY:
        raise AIError("GROQ_API_KEY is not set")
    content = [{"type": "text", "text": prompt + "\n\nReply with ONLY a JSON object that matches this JSON Schema:\n"
                + json.dumps(schema.model_json_schema())}]
    for data, mime in files:
        url = f"data:{mime};base64," + base64.b64encode(data).decode()
        content.append({"type": "image_url", "image_url": {"url": url}})
    payload = {"model": GROQ_MODEL, "temperature": 0, "response_format": {"type": "json_object"},
               "messages": [{"role": "user", "content": content}]}
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(URL, json=payload, headers={"Authorization": f"Bearer {GROQ_API_KEY}"})
        r.raise_for_status()
        text = r.json()["choices"][0]["message"]["content"] or ""
        return schema.model_validate_json(_json_from(text))
    except httpx.HTTPStatusError as exc:
        raise AIError(f"Groq returned HTTP {exc.response.status_code}: {exc.response.text[:200]}") from exc
    except httpx.HTTPError as exc:
        raise AIError(f"can't reach Groq ({type(exc).__name__}: {exc})") from exc
    except Exception as exc:  # bad JSON / wrong shape
        raise AIError(f"Groq answer in the wrong shape: {exc}") from exc
