"""Money check (Read mode): count notes/coins, check change after a bill, and flag OBVIOUS fake notes.
It never claims a note is genuine: a phone photo cannot check watermarks, threads or UV features.
Gemini only names each note and coin; Python does every sum."""
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

from ..schemas import AIMoney, MoneyItem, MoneyResult, SuspectNote
from ..config import GEMINI_READ_MODEL
from ..services import gemini, media, prompts, session
from ..services.phrases import say_money, t

router = APIRouter(tags=["read"])

# real Indian denominations in circulation; anything else means a misread
INR_NOTES = {10, 20, 50, 100, 200, 500, 2000}
INR_COINS = {1, 2, 5, 10, 20}
TOLERANCE = 0.5


def _breakdown(items: list, cur: str, lang: str) -> str:
    parts = []
    for i in sorted(items, key=lambda x: -x.value):
        word = t((i.kind + "s") if i.count > 1 else i.kind, lang)
        parts.append(f"{say_money(i.value, cur, lang)}, {i.count} {word}")
    return "; ".join(parts) + "."


def _fake_warnings(suspects: list, lang: str) -> str:
    return " ".join(
        t("fake_one", lang, value=f"{s.value:,.0f}", reason=t("reason_" + s.reason, lang)) for s in suspects
    )


@router.post("/money", response_model=MoneyResult)
async def money(
    image: UploadFile = File(...),
    mode: str = Form("count"),                  # "count" = money you are paying, "change" = change you got, "check" = fake-note check only
    lang: str = Form("en"),
    session_id: str = Form(""),
    paid: Optional[float] = Form(None),         # optional: amount paid, if the user said it instead of photographing it
    bill_total: Optional[float] = Form(None),   # optional: override the bill total from /read
):
    lang = prompts.lang_code(lang)
    mode = mode if mode in ("count", "change", "check") else "count"
    data, mime = await media.read_upload(image)
    ai = await gemini.ask(prompts.load("money", lang), AIMoney, [(data, mime)], model=GEMINI_READ_MODEL, timeout=18)

    cur = (ai.currency or "INR").strip().upper() or "INR"
    items = [MoneyItem(value=i.value, kind=i.kind, count=i.count) for i in ai.items if i.count > 0]
    unclear = ai.unclear
    if cur == "INR" and any(
        (i.kind == "note" and i.value not in INR_NOTES) or (i.kind == "coin" and i.value not in INR_COINS) for i in items
    ):
        unclear = True  # not a real denomination, so something was misread

    state = session.get(session_id) or {}
    bill = bill_total if bill_total is not None else state.get("bill_total")
    m = lambda x: say_money(x, cur, lang)  # noqa: E731
    suspects = [SuspectNote(value=s.value, reason=s.reason) for s in ai.suspicious] if cur == "INR" else []
    result = MoneyResult(mode=mode, speech="", currency=cur, items=items, bill_total=bill,
                         suspicious=suspects, unclear=unclear)
    warn = _fake_warnings(suspects, lang)  # safety first: fake warnings are always spoken before anything else

    if unclear and not suspects:
        result.speech = t("money_unclear", lang)
        return result
    if not items:
        result.speech = t("money_none", lang)
        return result

    total = round(sum(i.value * i.count for i in items), 2)
    result.total = total
    head = t("money_total", lang, total=m(total)) + " " + _breakdown(items, cur, lang)

    if mode == "check":
        n_notes = sum(i.count for i in items if i.kind == "note")
        if suspects:
            result.speech = warn
        elif unclear:
            result.speech = t("money_unclear", lang)
        else:
            result.speech = t("no_obvious_fake", lang, n=n_notes, notes=t("notes" if n_notes != 1 else "note", lang))
        return result
    if warn:
        head = warn + " " + head

    if mode == "count":
        session.update(session_id, paid=total)
        result.paid = total
        if bill is None:
            result.speech = head
        elif total < bill - TOLERANCE:
            result.speech = head + " " + t("money_not_enough", lang, short=m(bill - total), bill=m(bill))
        elif abs(total - bill) <= TOLERANCE:
            result.expected_change = 0
            result.speech = head + " " + t("money_exact", lang)
        else:
            result.expected_change = round(total - bill, 2)
            result.speech = head + " " + t("money_paying", lang, paid=m(total), bill=m(bill), expected=m(total - bill))
        return result

    # ---- mode == "change": the photo shows the change received ----
    paid_amount = paid if paid is not None else state.get("paid")
    result.paid = paid_amount
    if bill is None:
        result.speech = t("need_bill", lang)
        return result
    if paid_amount is None:
        result.speech = t("need_paid", lang)
        return result

    expected = round(paid_amount - bill, 2)
    got = round(total - sum(sp.value for sp in suspects), 2)  # a possibly-fake note does not count as change
    result.total = got
    diff = round(got - expected, 2)
    result.expected_change, result.difference = expected, diff
    if abs(diff) <= TOLERANCE:
        result.speech = t("change_ok", lang, got=m(got))
    elif diff < 0:
        result.speech = t("change_short", lang, expected=m(expected), got=m(got), diff=m(-diff))
    else:
        result.speech = t("change_extra", lang, expected=m(expected), got=m(got), diff=m(diff))
    if warn:
        result.speech = warn + " " + result.speech
    return result
