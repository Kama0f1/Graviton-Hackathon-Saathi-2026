"""Runs every endpoint with Gemini faked, so no API key or internet is needed.
Run from backend/:  pytest -q"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import AIBillItem, AIField, AIGuidance, AIRead, AIWaste, SignResult, SpeechOnly
from app.services import gemini

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100
PDF = b"%PDF-1.4 fake"


def fake(answer):
    async def _ask(prompt, schema, files=(), model=None, **kwargs):
        return answer
    return _ask


def bill(total, uncertain=(), currency="INR"):
    return AIRead(
        kind="bill", doc_type="shop bill", summary_speech="Shop bill", full_text="...",
        key_fields=[], shop="Ramesh Traders",
        items=[AIBillItem(name="Atta", qty=5, unit="packet", amount=2200),
               AIBillItem(name="Sugar", qty=50, unit="kg", amount=2150)],
        printed_total=total, currency=currency, uncertain=list(uncertain),
    )


def post(path, monkeypatch, answer, data=None, file=("x.jpg", JPEG, "image/jpeg"), field="image"):
    monkeypatch.setattr(gemini, "ask", fake(answer))
    files = {field: file} if file else None
    return client.post(path, data=data or {"lang": "en", "session_id": "s1"}, files=files)


def test_health():
    assert client.get("/health").json() == {"ok": True}


def test_bill_overcharge_is_caught(monkeypatch):
    r = post("/read", monkeypatch, bill(4830), field="file")
    body = r.json()
    assert r.status_code == 200
    assert body["bill"]["computed_total"] == 4350
    assert body["bill"]["mismatch"] is True
    assert "4,350" in body["speech"] and "4,830" in body["speech"]


def test_bill_correct_total(monkeypatch):
    body = post("/read", monkeypatch, bill(4350), field="file").json()
    assert body["bill"]["mismatch"] is False
    assert "Warning" not in body["speech"]


def test_unsure_total_that_adds_up_is_trusted(monkeypatch):
    # the model marked the total unsure, but the items add up to it: the maths confirms the reading, no retake
    body = post("/read", monkeypatch, bill(4350, ["printed_total"]), field="file").json()
    assert "take the photo again" not in body["speech"] and body["uncertain"] == []


def test_second_look_fixes_a_misread(monkeypatch):
    first, second = bill(4350), bill(4350)
    first.items[0].amount += 600          # misread digit: does not add up
    answers = iter([first, second])

    async def ask(prompt, schema, files=(), model=None, **kw):
        return next(answers)
    monkeypatch.setattr(gemini, "ask", ask)
    body = client.post("/read", data={"lang": "en"}, files={"file": ("x.jpg", JPEG, "image/jpeg")}).json()
    assert body["bill"]["mismatch"] is False and "take the photo again" not in body["speech"]


def test_two_readings_agree_on_overcharge(monkeypatch):
    ai = bill(4350)
    ai.printed_total = 4830                # really overcharged: both looks see the same numbers
    body = post("/read", monkeypatch, ai, field="file").json()
    assert body["bill"]["mismatch"] is True and "4,830" in body["speech"]


def test_unreadable_and_not_adding_up_asks_retake(monkeypatch):
    first, second = bill(4350, ["printed_total"]), bill(4350, ["printed_total"])
    first.printed_total, second.printed_total = 4950, 5350   # two different guesses, both unsure
    answers = iter([first, second])

    async def ask(prompt, schema, files=(), model=None, **kw):
        return next(answers)
    monkeypatch.setattr(gemini, "ask", ask)
    body = client.post("/read", data={"lang": "en"}, files={"file": ("x.jpg", JPEG, "image/jpeg")}).json()
    assert "take the photo again" in body["speech"]


def test_euro_bill_spoken_naturally(monkeypatch):
    ai = bill(23.9, currency="EUR")
    ai.items = [AIBillItem(name="27", qty=1, unit=None, amount=4.0),
                AIBillItem(name="83", qty=1, unit=None, amount=19.9)]
    body = post("/read", monkeypatch, ai, field="file").json()
    assert "23 euros 90 cents" in body["speech"] and "rupees" not in body["speech"]
    assert body["speech_more"].startswith("Item 27, 4 euros.")
    assert body["bill"]["currency"] == "EUR" and body["bill"]["mismatch"] is False


def test_multiple_bills_mentioned(monkeypatch):
    body = post("/read", monkeypatch, bill(4350, ["multiple_bills"]), field="file").json()
    assert body["speech"].startswith("There is more than one bill")


def test_bill_in_hindi(monkeypatch):
    body = post("/read", monkeypatch, bill(4830), data={"lang": "hi", "session_id": "s1"}, field="file").json()
    assert "रुपये" in body["speech"]


def test_document_then_question(monkeypatch):
    doc = AIRead(kind="document", doc_type="bank letter", summary_speech="A letter from your bank.",
                 full_text="Card expires 15 December.", key_fields=[AIField(name="expiry", value="15 December")],
                 shop=None, items=[], printed_total=None, currency="INR", uncertain=[])
    r = post("/read", monkeypatch, doc, file=("a.pdf", PDF, "application/pdf"), field="file")
    assert r.json()["key_fields"] == {"expiry": "15 December"}
    ans = post("/read/ask", monkeypatch, SpeechOnly(speech="It expires on 15 December."),
               data={"question": "When does it expire?", "lang": "en", "session_id": "s1"}, file=None)
    assert ans.json()["speech"].startswith("It expires")


def test_ask_without_document(monkeypatch):
    r = post("/read/ask", monkeypatch, SpeechOnly(speech="x"),
             data={"question": "?", "lang": "en", "session_id": "nobody"}, file=None)
    assert r.json()["speech"] == "Please read a document first."


def test_waste_rules_pick_the_bin(monkeypatch):
    ai = AIWaste(item="plastic bottle", item_spoken="Plastic bottle", category="dry", confident=True)
    body = post("/waste", monkeypatch, ai).json()
    assert body["bin_color"] == "blue"
    assert body["speech"] == "Plastic bottle. Dry waste. Blue bin."


def test_waste_not_confident(monkeypatch):
    ai = AIWaste(item="unknown", item_spoken="Something", category="dry", confident=False)
    assert post("/waste", monkeypatch, ai).json()["bin_color"] is None


def test_guidance_phrase_comes_from_python(monkeypatch):
    body = post("/guidance", monkeypatch, AIGuidance(ready=False, move="left")).json()
    assert body == {"ready": False, "move": "left", "speech": "Move phone left."}


def test_sign_and_describe(monkeypatch):
    assert post("/sign", monkeypatch, SignResult(speech="Exit.", text="EXIT", confident=True)).status_code == 200
    assert post("/describe", monkeypatch, SpeechOnly(speech="A door ahead.")).json()["speech"] == "A door ahead."


def test_pdf_rejected_on_image_endpoint(monkeypatch):
    r = post("/waste", monkeypatch, None, file=("a.pdf", PDF, "application/pdf"))
    assert r.status_code == 400 and r.json()["speech"]


def test_missing_key_gives_speakable_error(monkeypatch):
    from app.services import errors

    async def broken(*a, **k):
        raise errors.AIError("GEMINI_API_KEY is not set")
    monkeypatch.setattr(gemini, "ask", broken)
    r = client.post("/describe", data={"lang": "en"}, files={"image": ("x.jpg", JPEG, "image/jpeg")})
    assert r.status_code == 503 and r.json()["speech"]


def test_read_prompt_knows_today_for_expiry_dates(monkeypatch):
    seen = {}

    async def ask(prompt, schema, files=(), model=None, **kw):
        seen["prompt"] = prompt
        return AIRead(kind="document", doc_type="price tag", summary_speech="Amul butter, 100 grams. MRP 58 rupees.",
                      full_text="MRP 58", key_fields=[AIField(name="mrp", value="58 rupees")], shop=None, items=[],
                      printed_total=None, currency="INR", uncertain=[])
    monkeypatch.setattr(gemini, "ask", ask)
    body = client.post("/read", data={"lang": "en"}, files={"file": ("x.jpg", JPEG, "image/jpeg")}).json()
    assert "{today}" not in seen["prompt"] and "Today is " in seen["prompt"] and "PRICE TAG" in seen["prompt"]
    assert body["kind"] == "document" and body["speech"].startswith("Amul butter")
