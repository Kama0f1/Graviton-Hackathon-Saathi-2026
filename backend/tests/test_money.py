"""Money check with Gemini faked. Flow: read bill -> count money paid -> check change."""
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import AIBillItem, AIMoney, AIMoneyItem, AIRead, AISuspect
from app.services import gemini

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


def fake(answer):
    async def _ask(prompt, schema, files=(), model=None, **kwargs):
        return answer
    return _ask


def cash(*pairs, unclear=False, suspicious=()):
    return AIMoney(items=[AIMoneyItem(value=v, kind="note" if v >= 10 and v not in (1, 2, 5) else "coin", count=c)
                          for v, c in pairs], currency="INR", unclear=unclear,
                  suspicious=list(suspicious))


def send(monkeypatch, answer, path="/money", **data):
    monkeypatch.setattr(gemini, "ask", fake(answer))
    form = {"lang": "en", "session_id": "shop", **{k: str(v) for k, v in data.items()}}
    field = "file" if path == "/read" else "image"
    return client.post(path, data=form, files={field: ("x.jpg", JPEG, "image/jpeg")}).json()


def read_bill(monkeypatch, sid, total=430):
    ai = AIRead(kind="bill", doc_type="shop bill", summary_speech="Shop bill", full_text="...", key_fields=[],
                shop="Kirana", items=[AIBillItem(name="Rice", qty=1, unit=None, amount=total)],
                printed_total=total, currency="INR", uncertain=[])
    send(monkeypatch, ai, path="/read", session_id=sid)


def test_count_without_bill(monkeypatch):
    body = send(monkeypatch, cash((500, 1), (100, 1), (50, 1)), session_id="solo")
    assert body["total"] == 650
    assert body["speech"].startswith("Total 650 rupees.")


def test_full_flow_short_change(monkeypatch):
    read_bill(monkeypatch, "s1", 430)
    paying = send(monkeypatch, cash((500, 1)), mode="count", session_id="s1")
    assert paying["expected_change"] == 70
    assert "You should get 70 rupees back" in paying["speech"]
    change = send(monkeypatch, cash((50, 1)), mode="change", session_id="s1")
    assert change["difference"] == -20
    assert change["speech"] == "You should get 70 rupees, but you got 50 rupees. 20 rupees short."


def test_correct_change_with_coins(monkeypatch):
    read_bill(monkeypatch, "s2", 430)
    send(monkeypatch, cash((500, 1)), mode="count", session_id="s2")
    body = send(monkeypatch, cash((50, 1), (10, 2)), mode="change", session_id="s2")
    assert body["speech"] == "Correct change: you got 70 rupees."


def test_not_enough_money(monkeypatch):
    read_bill(monkeypatch, "s3", 430)
    body = send(monkeypatch, cash((200, 2)), mode="count", session_id="s3")
    assert "30 rupees less than the bill" in body["speech"]


def test_change_needs_bill_first(monkeypatch):
    body = send(monkeypatch, cash((50, 1)), mode="change", session_id="nobill")
    assert body["speech"] == "Read the bill first, then check the change."


def test_fake_denomination_is_unclear(monkeypatch):
    body = send(monkeypatch, cash((300, 1)), session_id="odd")  # no 300 rupee note exists
    assert body["unclear"] is True and "take the photo again" in body["speech"]


def test_paid_can_be_spoken_instead(monkeypatch):
    read_bill(monkeypatch, "s4", 430)
    body = send(monkeypatch, cash((50, 1), (20, 1)), mode="change", session_id="s4", paid=500)
    assert body["speech"] == "Correct change: you got 70 rupees."


def test_hindi_change(monkeypatch):
    read_bill(monkeypatch, "s5", 430)
    send(monkeypatch, cash((500, 1)), mode="count", session_id="s5", lang="hi")
    body = send(monkeypatch, cash((50, 1)), mode="change", session_id="s5", lang="hi")
    assert "20 रुपये" in body["speech"] and "कम" in body["speech"]


def test_check_flags_toy_note(monkeypatch):
    body = send(monkeypatch, cash((500, 1), suspicious=[AISuspect(value=500, reason="toy_text")]),
                mode="check", session_id="chk")
    assert body["suspicious"][0]["reason"] == "toy_text"
    assert body["speech"].startswith("Warning: the 500 rupee note may be fake")


def test_check_never_says_genuine(monkeypatch):
    body = send(monkeypatch, cash((500, 2)), mode="check", session_id="chk2")
    assert body["speech"].startswith("No obvious signs of a fake on 2 notes")
    assert "genuine" not in body["speech"].lower() and "real" not in body["speech"].lower()


def test_fake_warning_comes_first_in_change(monkeypatch):
    read_bill(monkeypatch, "s6", 430)
    send(monkeypatch, cash((500, 1)), mode="count", session_id="s6")
    body = send(monkeypatch, cash((50, 1), (20, 1), suspicious=[AISuspect(value=50, reason="photocopy")]),
                mode="change", session_id="s6")
    assert body["speech"].startswith("Warning: the 50 rupee note may be fake")
    # the suspect 50 is not counted, so only 20 of the 70 owed was received
    assert "you got 20 rupees. 50 rupees short." in body["speech"]
