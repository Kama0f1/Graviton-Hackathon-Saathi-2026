"""Is this my cab: plates are matched even when one character is misread."""
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import AIPlates, AIVehicle
from app.services import gemini
from app.services.plates import same_plate, spoken

client = TestClient(app)
JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100


def test_plate_matching_rules():
    assert same_plate("PB 65 AB 1234", "pb65ab1234")
    assert same_plate("PB65AB1234", "PB 65 A8 1234")      # B read as 8
    assert same_plate("PB65AB1234", "PB65AB123")          # one character missed
    assert same_plate("1234", "PB65AB1234")               # only the last digits given
    assert not same_plate("PB65AB1234", "PB10CX4321")
    assert not same_plate("PB65AB1234", "HR26DK1234")
    assert spoken("PB65AB1234") == "P B 65 A B 12 34"


def ask(monkeypatch, vehicles, plate="PB 65 AB 1234", lang="en"):
    async def fake(prompt, schema, files=(), model=None, **kw):
        return AIPlates(vehicles=vehicles)
    monkeypatch.setattr(gemini, "ask", fake)
    return client.post("/cab", data={"plate": plate, "lang": lang}, files={"image": ("x.jpg", JPEG, "image/jpeg")}).json()


def test_finds_my_cab(monkeypatch):
    r = ask(monkeypatch, [AIVehicle(plate="PB10CX4321", kind="auto", colour="green", position="left", metres=3),
                          AIVehicle(plate="PB 65 AB 1234", kind="car", colour="white", position="ahead", metres=6.4)])
    assert r["match"] and r["speech"] == "That is your cab: white car, P B 65 A B 12 34, ahead, 6 metres."


def test_not_my_cab_lists_what_it_sees(monkeypatch):
    r = ask(monkeypatch, [AIVehicle(plate="PB10CX4321", kind="auto", colour="green", position="left", metres=3)])
    assert not r["match"] and r["speech"] == "Not your cab. I can see P B 10 C X 43 21."


def test_no_plates(monkeypatch):
    assert "No number plate" in ask(monkeypatch, [])["speech"]
    assert "cannot read its plate" in ask(monkeypatch, [AIVehicle(plate="", kind="car", colour="red", position="ahead", metres=8)])["speech"]
