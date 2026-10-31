"""Groq backup kicks in only when Gemini fails, only for images, only with a key."""
import asyncio

import pytest

from app.schemas import SpeechOnly
from app.services import gemini, groq
from app.services.errors import AIError

IMG = [(b"\xff\xd8\xff", "image/jpeg")]
PDF = [(b"%PDF", "application/pdf")]


async def gemini_down(*a, **k):
    raise AIError("Gemini took too long (over 25 s)")


async def groq_ok(prompt, schema, files=(), timeout=20.0):
    return SpeechOnly(speech="from groq")


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setattr(gemini, "_ask_gemini", gemini_down)
    monkeypatch.setattr(groq, "ask", groq_ok)
    monkeypatch.setattr(groq, "GROQ_API_KEY", "test-key")
    return monkeypatch


def test_backup_answers_when_gemini_fails(setup):
    assert asyncio.run(gemini.ask("x", SpeechOnly, IMG)).speech == "from groq"


def test_no_backup_for_pdf(setup):
    with pytest.raises(AIError):
        asyncio.run(gemini.ask("x", SpeechOnly, PDF))


def test_no_backup_when_disabled(setup):
    with pytest.raises(AIError):
        asyncio.run(gemini.ask("x", SpeechOnly, IMG, fallback=False))


def test_no_backup_without_key(setup):
    setup.setattr(groq, "GROQ_API_KEY", "")
    with pytest.raises(AIError):
        asyncio.run(gemini.ask("x", SpeechOnly, IMG))


def test_json_extraction_strips_reasoning():
    assert groq._json_from('<think>hmm</think> here: {"speech": "hi"} done') == '{"speech": "hi"}'


def test_guidance_uses_backup_on_rate_limit(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app
    from app.schemas import AIGuidance

    async def limited(*a, **k):
        raise AIError("Gemini call failed: rate limit / quota hit, wait a minute (429)")

    async def groq_guide(prompt, schema, files=(), timeout=20.0):
        return AIGuidance(ready=False, move="left")
    monkeypatch.setattr(gemini, "ask", limited)
    monkeypatch.setattr(groq, "ask", groq_guide)
    monkeypatch.setattr(groq, "GROQ_API_KEY", "test-key")
    r = TestClient(app).post("/guidance", data={"target": "bill"}, files={"image": ("x.jpg", b"\xff\xd8\xff" + b"0" * 50, "image/jpeg")})
    assert r.json() == {"ready": False, "move": "left", "speech": "Move phone left."}
