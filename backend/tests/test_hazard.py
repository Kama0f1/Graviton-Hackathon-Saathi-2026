"""Hazard watch: the AI names the hazard, Python decides the words and how urgent it is."""
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import AIHazard
from app.services import gemini
from app.services.errors import AIError

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


def ask(monkeypatch, answer, lang="en"):
    async def fake(prompt, schema, files=(), model=None, **kw):
        if isinstance(answer, Exception):
            raise answer
        return answer
    monkeypatch.setattr(gemini, "ask", fake)
    return client.post("/hazard", data={"lang": lang}, files={"image": ("x.jpg", JPEG, "image/jpeg")}).json()


def test_stairs_down_is_urgent_early(monkeypatch):
    r = ask(monkeypatch, AIHazard(hazard="stairs_down", position="ahead", metres=2.7))
    assert r["urgent"] and r["speech"] == "Stairs going down ahead, 3 metres."


def test_wall_far_is_not_urgent(monkeypatch):
    r = ask(monkeypatch, AIHazard(hazard="wall", position="ahead", metres=3.2))
    assert not r["urgent"] and r["speech"] == "Wall ahead, 3 metres."


def test_touching_distance_says_stop(monkeypatch):
    r = ask(monkeypatch, AIHazard(hazard="pole", position="left", metres=0.2))
    assert r["urgent"] and r["speech"].startswith("Stop. Pole on your left")


def test_far_things_stay_quiet(monkeypatch):
    assert ask(monkeypatch, AIHazard(hazard="wall", position="ahead", metres=9))["hazard"] == "none"
    assert ask(monkeypatch, AIHazard(hazard="none", position="ahead", metres=0))["speech"] == ""


def test_hindi(monkeypatch):
    r = ask(monkeypatch, AIHazard(hazard="stairs_up", position="right", metres=1.4), lang="hi")
    assert r["speech"] == "ऊपर जाती सीढ़ियाँ आपकी दाईं ओर, 1.5 मीटर पर।"


def test_slow_frame_is_not_an_error(monkeypatch):
    r = ask(monkeypatch, AIError("Gemini took too long (over 5 s)"))
    assert r["hazard"] == "none"


def test_close_distances_are_spoken_clearly(monkeypatch):
    assert ask(monkeypatch, AIHazard(hazard="glass", position="ahead", metres=0.6))["speech"] == "Glass door or glass wall ahead, less than 1 metre."
    assert ask(monkeypatch, AIHazard(hazard="door", position="ahead", metres=1.1))["speech"] == "Closed door ahead, 1 metre."
    r = ask(monkeypatch, AIHazard(hazard="kerb", position="left", metres=1.6), lang="pa")
    assert r["speech"] == "ਫੁੱਟਪਾਥ ਦਾ ਕਿਨਾਰਾ ਤੁਹਾਡੇ ਖੱਬੇ ਪਾਸੇ, 1.5 ਮੀਟਰ 'ਤੇ।" and r["urgent"]
