"""Shapes Gemini must answer in. Internal only: the phone never sees these.
No defaults and no dicts here, because Gemini's schema support is stricter than Pydantic's."""
from typing import List, Literal, Optional

from pydantic import BaseModel


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
