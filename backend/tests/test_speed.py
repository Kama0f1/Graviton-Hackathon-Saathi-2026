"""Timeouts and image shrinking."""
import asyncio
import io

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.services import gemini, media
from app.services.errors import AIError

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


def big_photo() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (4000, 3000), (200, 180, 160)).save(out, "JPEG", quality=95)
    return out.getvalue()


def test_shrink_big_photo():
    data, mime = media.shrink(big_photo(), "image/jpeg", 1024)
    assert mime == "image/jpeg" and max(Image.open(io.BytesIO(data)).size) == 1024


def test_shrink_leaves_pdf_and_junk_alone():
    assert media.shrink(b"%PDF-1.4", "application/pdf", 512) == (b"%PDF-1.4", "application/pdf")
    assert media.shrink(JPEG, "image/jpeg", 512) == (JPEG, "image/jpeg")  # not a real image: passed through


def test_slow_gemini_becomes_spoken_timeout(monkeypatch):
    async def slow(*a, **k):
        raise AIError("Gemini took too long (over 25 s)")
    monkeypatch.setattr(gemini, "ask", slow)
    r = client.post("/describe", data={"lang": "en"}, files={"image": ("x.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 504 and r.json()["speech"] == "That is taking too long. Please try again."


def test_slow_guidance_frame_is_silent(monkeypatch):
    async def slow(*a, **k):
        raise AIError("Gemini took too long (over 6 s)")
    monkeypatch.setattr(gemini, "ask", slow)
    r = client.post("/guidance", data={"target": "bill"}, files={"image": ("x.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 200 and r.json() == {"ready": False, "move": "none", "speech": ""}


def test_wait_for_timeout_is_converted(monkeypatch):
    class Slow:
        class aio:
            class models:
                @staticmethod
                async def generate_content(**k):
                    await asyncio.sleep(5)
    monkeypatch.setattr(gemini, "_get_client", lambda: Slow)
    from app.schemas import SpeechOnly
    try:
        asyncio.run(gemini.ask("x", SpeechOnly, timeout=0.1))
        assert False, "should time out"
    except AIError as exc:
        assert "too long" in str(exc)
