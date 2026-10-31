"""Read mode: /read (document or bill) and /read/ask (questions about the last one)."""
import json
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from ..config import GEMINI_READ_MODEL

from ..schemas import AIRead, Bill, BillItem, ReadResult, SpeechOnly
from ..services import bill_check, gemini, media, prompts, session
from ..services.phrases import qty, say_money, t

router = APIRouter(tags=["read"])
RETAKE_FIELDS = {"printed_total", "items"}


def _from_context(raw: str) -> Optional[dict]:
    """The document the app sent back with the question. On serverless hosting (Vercel) each request
    can land on a different machine, so the app's copy is more reliable than server memory."""
    if not raw:
        return None
    try:
        c = json.loads(raw)
        text = str(c.get("text") or "")
        fields = c.get("fields") or {}
        if not text and not fields:
            return None
        return {"doc_type": str(c.get("doc_type") or "document"), "text": text,
                "fields": {str(k): str(v) for k, v in dict(fields).items()}}
    except (ValueError, TypeError, AttributeError):
        return None


def _item_line(item: BillItem, currency: str, lang: str) -> str:
    name = item.name.strip()
    if name.replace(".", "").replace("-", "").isdigit():  # just an item code, e.g. "27"
        name = t("item_code", lang, code=name)
    parts = [name]
    if item.qty is not None and not (item.qty == 1 and not item.unit):  # "1" alone adds nothing
        parts.append(f"{qty(item.qty)} {item.unit or ''}".strip())
    parts.append(say_money(item.amount, currency, lang))
    return ", ".join(parts) + "."


@router.post("/read", response_model=ReadResult)
async def read(file: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    lang = prompts.lang_code(lang)
    data, mime = await media.read_upload(file, allow_pdf=True, max_side=1600)  # bills need detail
    ai = await gemini.ask(prompts.load("read", lang), AIRead, [(data, mime)], model=GEMINI_READ_MODEL, timeout=22)
    fields = {f.name: f.value for f in ai.key_fields}
    session.save(session_id, {"doc_type": ai.doc_type, "text": ai.full_text, "fields": fields})

    if ai.kind == "document":
        return ReadResult(
            kind="document", doc_type=ai.doc_type, speech=ai.summary_speech,
            speech_more=ai.full_text, full_text=ai.full_text, key_fields=fields, uncertain=ai.uncertain,
        )

    # ---- bill: the AI only transcribed it; Python does every number ----
    uncertain = list(ai.uncertain)
    if any(i.amount is None for i in ai.items) and "items" not in uncertain:
        uncertain.append("items")
    items = [BillItem(name=i.name, qty=i.qty, unit=i.unit, amount=i.amount) for i in ai.items if i.amount is not None]
    cur = (ai.currency or "INR").strip().upper() or "INR"
    shop = ai.shop.title() if ai.shop and ai.shop.isupper() else ai.shop  # "SHARMA KIRANA" -> "Sharma Kirana"
    bill = bill_check.check(Bill(shop=shop, currency=cur, items=items, printed_total=ai.printed_total))
    more = " ".join(_item_line(i, cur, lang) for i in bill.items)
    m = lambda x: say_money(x, cur, lang)  # noqa: E731

    if not items or RETAKE_FIELDS & set(uncertain):
        speech = t("retake", lang)
    else:
        n = len(items)
        if bill.printed_total is None:
            speech = t("bill_head_nototal", lang, shop=bill.shop or "", n=n, sum=m(bill.computed_total)).lstrip("।. ")
        elif bill.shop:
            speech = t("bill_head", lang, shop=bill.shop, n=n, total=m(bill.printed_total))
        else:
            speech = t("bill_head_noshop", lang, n=n, total=m(bill.printed_total))
        if bill.mismatch:
            speech += " " + t("mismatch", lang, sum=m(bill.computed_total), total=m(bill.printed_total))
        if "multiple_bills" in uncertain:
            speech = t("multiple_bills", lang) + " " + speech

    charged = bill.printed_total if bill.printed_total is not None else (bill.computed_total if items else None)
    session.update(session_id, bill_total=charged, currency=cur)

    return ReadResult(
        kind="bill", doc_type=ai.doc_type, speech=speech, speech_more=more, full_text=ai.full_text,
        key_fields=fields, bill=bill, uncertain=uncertain,
    )


@router.post("/read/ask", response_model=SpeechOnly)
async def ask(question: str = Form(...), lang: str = Form("en"), session_id: str = Form(""),
              context: str = Form("")):
    lang = prompts.lang_code(lang)
    doc = _from_context(context) or session.get(session_id)
    if not doc:
        return SpeechOnly(speech=t("no_doc", lang))
    fields = "\n".join(f"- {k}: {v}" for k, v in doc["fields"].items()) or "(none)"
    prompt = prompts.load(
        "ask", lang, doc_type=doc["doc_type"], fields=fields,
        text=doc["text"][:20000], question=question.strip()[:500],
    )
    return await gemini.ask(prompt, SpeechOnly, model=GEMINI_READ_MODEL, timeout=15)
