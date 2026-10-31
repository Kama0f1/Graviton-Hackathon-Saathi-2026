# THE API CONTRACT. Frontend depends on these shapes — change only with both sides agreeing.
from typing import Literal, Optional
from pydantic import BaseModel, Field

Lang = Literal["en", "hi", "pa"]


class SpeechOnly(BaseModel):
    speech: str


class SignResult(BaseModel):
    speech: str
    text: str
    confident: bool


class WasteResult(BaseModel):
    speech: str
    item: str
    category: Literal["wet", "dry", "hazardous", "unknown"]
    bin_color: Optional[Literal["green", "blue", "red"]] = None
    confident: bool


class GuidanceResult(BaseModel):
    ready: bool
    move: Literal["left", "right", "up", "down", "closer", "back", "hold", "light", "none"]
    speech: str


class BillItem(BaseModel):
    name: str
    qty: Optional[float] = None
    unit: Optional[str] = None
    amount: float


class Bill(BaseModel):
    shop: Optional[str] = None
    currency: str = "INR"
    items: list[BillItem] = Field(default_factory=list)
    printed_total: Optional[float] = None
    computed_total: Optional[float] = None
    mismatch: bool = False


class ReadResult(BaseModel):
    kind: Literal["document", "bill"]
    speech: str
    speech_more: str = ""
    full_text: str = ""  # the whole text; the app sends it back with questions (works without server memory)
    doc_type: Optional[str] = None
    key_fields: dict = Field(default_factory=dict)
    bill: Optional[Bill] = None
    uncertain: list[str] = Field(default_factory=list)


class MoneyItem(BaseModel):
    value: float
    kind: Literal["note", "coin"]
    count: int


class SuspectNote(BaseModel):
    value: float
    reason: Literal["not_rbi", "toy_text", "photocopy", "mismatch", "other"]


class MoneyResult(BaseModel):
    mode: Literal["count", "change", "check"]
    speech: str
    currency: str = "INR"
    total: float = 0                          # money counted in this photo
    items: list[MoneyItem] = Field(default_factory=list)
    bill_total: Optional[float] = None        # from the last /read bill in this session
    paid: Optional[float] = None              # what the user handed over
    expected_change: Optional[float] = None   # paid - bill_total
    difference: Optional[float] = None        # change got - expected (negative = short)
    suspicious: list[SuspectNote] = Field(default_factory=list)  # notes with OBVIOUS fake signs
    unclear: bool = False
    maybe: list[float] = Field(default_factory=list)  # unclear between these values, e.g. [10, 20]
    checks: list[str] = Field(default_factory=list)   # note check: what looked right ("rbi_text", "gandhi", "thread")


class ErrorResult(BaseModel):
    error: str
    speech: str = "Sorry, I couldn't do that. Please try again."


class HazardResult(BaseModel):
    hazard: str                 # "none", "stairs_down", "wall", ...
    position: Literal["left", "ahead", "right"] = "ahead"
    metres: float = 0     # rounded: 0.5 m steps up to 2 m, then whole metres
    urgent: bool = False        # close or a drop: the phone interrupts and vibrates
    speech: str = ""            # empty when there is nothing worth saying


class BinSpotResult(BaseModel):
    found: bool = False
    position: Literal["left", "ahead", "right"] = "ahead"
    metres: float = 0
    color: str = ""
    speech: str = ""            # what to say: where the bin is, or "turn slowly"
