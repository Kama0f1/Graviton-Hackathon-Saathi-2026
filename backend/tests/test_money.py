"""Money check with Gemini faked. Flow: read bill -> count money paid -> check change."""
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import AIBillItem, AICash, AIPiece, AIRead, AISuspect
from app.services import gemini

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


def fake(answer):
    async def _ask(prompt, schema, files=(), model=None, **kwargs):
        return answer
    return _ask


def piece(v, numeral=None, words="", kind=None, side="front", visible=True, thread=True):
    kind = kind or ("note" if v >= 10 and v not in (1, 2, 5) else "coin")
    return AIPiece(kind=kind, side=side, numeral_seen=str(int(v)) if numeral is None else numeral, words_seen=words,
                   colour="", value=v, fully_visible=visible, rbi_text=kind == "note", gandhi_portrait=kind == "note",
                   security_thread=thread and kind == "note")


def cash(*pairs, unclear=False, suspicious=()):
    pieces = [piece(v, visible=not unclear) for v, c in pairs for _ in range(c)]
    return AICash(pieces=pieces, currency="INR", suspicious=list(suspicious))


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
    body = send(monkeypatch, AICash(pieces=[piece(300, numeral="300")], currency="INR", suspicious=[]), session_id="odd")
    assert body["unclear"] is True and "take the photo again" in body["speech"]  # no 300 rupee note exists


def test_printed_digits_beat_the_guess(monkeypatch):
    # the model said 20, but the digits it read are 10: the note is a 10
    body = send(monkeypatch, AICash(pieces=[piece(20, numeral="10")], currency="INR", suspicious=[]), session_id="ten")
    assert body["total"] == 10 and body["items"][0]["value"] == 10


def test_words_and_devanagari_digits(monkeypatch):
    p1 = piece(20, numeral="", words="दस रुपये")
    p2 = piece(50, numeral="५००")
    body = send(monkeypatch, AICash(pieces=[p1, p2], currency="INR", suspicious=[]), session_id="dev")
    assert sorted(i["value"] for i in body["items"]) == [10, 500]


def test_models_disagree_without_evidence_asks_which(monkeypatch):
    answers = {"main": AICash(pieces=[piece(20, numeral="")], currency="INR", suspicious=[]),
               "fast": AICash(pieces=[piece(10, numeral="")], currency="INR", suspicious=[])}

    async def ask(prompt, schema, files=(), model=None, **kw):
        return answers["fast" if model == "fast" else "main"]
    import app.routers.money as money_router
    monkeypatch.setattr(money_router, "GEMINI_MODEL", "fast")
    monkeypatch.setattr(gemini, "ask", ask)
    body = client.post("/money", data={"lang": "en", "session_id": "vote"}, files={"image": ("x.jpg", JPEG, "image/jpeg")}).json()
    assert body["unclear"] and body["maybe"] == [10, 20]
    assert body["speech"].startswith("I am not sure if this is a 10 or a 20 rupee note")


def test_note_check_says_which_note(monkeypatch):
    body = send(monkeypatch, cash((500, 1)), mode="check", session_id="which")
    assert body["speech"].startswith("This is a 500 rupee note. No signs of a fake")
    assert body["checks"] == ["rbi_text", "gandhi", "thread"]


def test_note_check_back_side_asks_to_turn(monkeypatch):
    body = send(monkeypatch, AICash(pieces=[piece(100, side="back")], currency="INR", suspicious=[]), mode="check", session_id="back")
    assert body["speech"] == "This is a 100 rupee note. Turn it over so I can see Gandhi's portrait and the security thread."


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
    assert body["speech"].startswith("2 notes: 500, 500 rupees. No signs of a fake")
    assert "genuine" not in body["speech"].lower() and "real" not in body["speech"].lower()


def test_fake_warning_comes_first_in_change(monkeypatch):
    read_bill(monkeypatch, "s6", 430)
    send(monkeypatch, cash((500, 1)), mode="count", session_id="s6")
    body = send(monkeypatch, cash((50, 1), (20, 1), suspicious=[AISuspect(value=50, reason="photocopy")]),
                mode="change", session_id="s6")
    assert body["speech"].startswith("Warning: the 50 rupee note may be fake")
    # the suspect 50 is not counted, so only 20 of the 70 owed was received
    assert "you got 20 rupees. 50 rupees short." in body["speech"]
