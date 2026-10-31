"""Bin finder: the AI only says where the bin is, Python builds the sentence."""
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import AIBinSpot
from app.services import gemini

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


def ask(monkeypatch, answer, lang="en", color=""):
    seen = {}

    async def fake(prompt, schema, files=(), model=None, **kw):
        seen["prompt"] = prompt
        return answer
    monkeypatch.setattr(gemini, "ask", fake)
    r = client.post("/findbin", data={"lang": lang, "color": color}, files={"image": ("x.jpg", JPEG, "image/jpeg")}).json()
    return r, seen["prompt"]


def test_bin_on_the_left_with_distance(monkeypatch):
    r, _ = ask(monkeypatch, AIBinSpot(found=True, position="left", metres=2.6, color="blue"))
    assert r["found"] and r["speech"] == "Blue bin on your left, 3 metres."


def test_close_bin_says_reach_out(monkeypatch):
    r, _ = ask(monkeypatch, AIBinSpot(found=True, position="ahead", metres=0.4, color="other"))
    assert r["speech"] == "Bin right in front of you. Reach out."


def test_no_bin_says_turn(monkeypatch):
    r, _ = ask(monkeypatch, AIBinSpot(found=False, position="ahead", metres=0, color="other"))
    assert not r["found"] and "Turn slowly" in r["speech"]


def test_wanted_colour_goes_in_the_prompt_and_hindi(monkeypatch):
    r, prompt = ask(monkeypatch, AIBinSpot(found=True, position="right", metres=1.5, color="green"), lang="hi", color="green")
    assert "green bin" in prompt
    assert r["speech"] == "हरा डिब्बा आपकी दाईं ओर, 1.5 मीटर पर।"
