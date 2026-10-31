"""Shapes Gemini must answer in. Internal only: the phone never sees these.
No defaults and no dicts here, because Gemini's schema support is stricter than Pydantic's."""
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class AIField(BaseModel):
    name: str
    value: str


class AIBillItem(BaseModel):
    name: str
    qty: Optional[float]
    unit: Optional[str]
    amount: Optional[float]


class AIRead(BaseModel):
    kind: Literal["document", "bill"]
    doc_type: str
    summary_speech: str
    full_text: str
    key_fields: List[AIField]
    shop: Optional[str]
    items: List[AIBillItem]
    printed_total: Optional[float]
    currency: str
    uncertain: List[str]


class AIMoneyItem(BaseModel):
    value: float
    kind: Literal["note", "coin"]
    count: int


class AISuspect(BaseModel):
    value: float
    reason: Literal["not_rbi", "toy_text", "photocopy", "mismatch", "other"]


class AIPiece(BaseModel):
    """One banknote or coin. Evidence first (what is printed on it), the value last, so the value follows the evidence."""
    kind: Literal["note", "coin"]
    side: Literal["front", "back", "unknown"]   # front = the Gandhi side
    numeral_seen: str        # digits printed on it, exactly as read ("10", "500"); "" if no number is readable
    words_seen: str          # value in words as printed ("TEN RUPEES", "दस रुपये"); "" if not readable
    colour: str              # main colour of the note
    value: float             # face value
    fully_visible: bool      # false if folded, covered, cut off or blurry
    rbi_text: bool           # "Reserve Bank of India" / "भारतीय रिज़र्व बैंक" is readable
    gandhi_portrait: bool    # Mahatma Gandhi's portrait is visible
    security_thread: bool    # the striped security thread is visible


class AICash(BaseModel):
    pieces: List[AIPiece]
    currency: str
    suspicious: List[AISuspect]


class AIMoney(BaseModel):
    items: List[AIMoneyItem]
    currency: str
    unclear: bool
    suspicious: List[AISuspect]


class AIWaste(BaseModel):
    item: str
    item_spoken: str
    category: Literal["wet", "dry", "hazardous", "unknown"]
    confident: bool


class AIGuidance(BaseModel):
    ready: bool
    move: Literal["left", "right", "up", "down", "closer", "back", "hold", "light", "none"]


HAZARDS = Literal[
    "none", "stairs_up", "stairs_down", "step_down", "kerb", "wall", "glass", "door", "pole", "pothole",
    "open_drain", "vehicle", "two_wheeler", "animal", "person", "wet_floor", "barrier", "low_obstacle", "other",
]


class AIHazard(BaseModel):
    hazard: HAZARDS
    position: Literal["left", "ahead", "right"]
    metres: float   # how far away; clamped and rounded in Python


class AIBinSpot(BaseModel):
    found: bool                      # a dustbin / waste bin is visible
    position: Literal["left", "ahead", "right"]
    metres: float                    # how far away; clamped and rounded in Python
    color: Literal["blue", "green", "red", "yellow", "grey", "black", "steel", "other"]


class AIVehicle(BaseModel):
    plate: str                       # number plate exactly as read, "" if not readable
    kind: Literal["car", "auto", "bike", "bus", "truck", "other"]
    colour: str
    position: Literal["left", "ahead", "right"]
    metres: float


class AIPlates(BaseModel):
    vehicles: List[AIVehicle]
