"""Serverless hosting (Vercel): each request may hit a fresh machine with no memory.
The app sends what it knows back, so every flow still works with an empty server session."""
import json

from fastapi.testclient import TestClient

from app.main import app
from app.schemas import AIMoney, AIMoneyItem, SpeechOnly
from app.services import gemini, session

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


def capture(answer, seen):
    async def _ask(prompt, schema, files=(), model=None, **kwargs):
        seen.append(prompt)
        return answer
    return _ask


def test_ask_uses_context_sent_by_the_app(monkeypatch):
    seen = []
    monkeypatch.setattr(gemini, "ask", capture(SpeechOnly(speech="On 10 November."), seen))
    ctx = json.dumps({"doc_type": "electricity bill", "text": "Due date: 10 November 2026.", "fields": {"due": "10 November"}})
    r = client.post("/read/ask", data={"question": "When is it due?", "lang": "en", "session_id": "fresh-machine", "context": ctx})
    assert r.json()["speech"] == "On 10 November."
    assert "Due date: 10 November 2026." in seen[0] and "electricity bill" in seen[0]


def test_context_beats_stale_server_memory(monkeypatch):
    session.save("old", {"doc_type": "old letter", "text": "OLD TEXT", "fields": {}})
    seen = []
    monkeypatch.setattr(gemini, "ask", capture(SpeechOnly(speech="ok"), seen))
    ctx = json.dumps({"doc_type": "new bill", "text": "NEW TEXT", "fields": {}})
    client.post("/read/ask", data={"question": "?", "lang": "en", "session_id": "old", "context": ctx})
    assert "NEW TEXT" in seen[0] and "OLD TEXT" not in seen[0]


def test_bad_context_falls_back_politely(monkeypatch):
    monkeypatch.setattr(gemini, "ask", capture(SpeechOnly(speech="x"), []))
    r = client.post("/read/ask", data={"question": "?", "lang": "en", "session_id": "nobody", "context": "{not json"})
    assert r.json()["speech"] == "Please read a document first."


def test_change_check_with_no_server_memory(monkeypatch):
    change = AIMoney(items=[AIMoneyItem(value=50, kind="note", count=1)], currency="INR", unclear=False, suspicious=[])
    monkeypatch.setattr(gemini, "ask", capture(change, []))
    r = client.post("/money", data={"mode": "change", "lang": "en", "session_id": "fresh-2", "bill_total": "430", "paid": "500"},
                    files={"image": ("x.jpg", JPEG, "image/jpeg")}).json()
    assert r["expected_change"] == 70 and r["difference"] == -20
