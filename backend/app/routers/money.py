"""Money check (Read mode): count notes/coins, check change after a bill, and the note check (which note is it,
any OBVIOUS fake signs). It never claims a note is genuine: a phone photo cannot check watermarks or UV features.

Accuracy: the AI reports the evidence for each note first (digits and words printed on it), and Python decides the value
from that evidence. Two models read the same photo at once; if they disagree and the evidence cannot settle it, the user is
asked to show the number instead of being told a wrong value. Python does every sum."""
import asyncio
import re
from collections import Counter
from typing import List, Optional, Tuple

from fastapi import APIRouter, File, Form, UploadFile

from ..schemas import AICash, AIPiece, MoneyItem, MoneyResult, SuspectNote
from ..config import GEMINI_MODEL, GEMINI_READ_MODEL
from ..services import gemini, media, prompts, session
from ..services.phrases import say_money, t

router = APIRouter(tags=["read"])

# real Indian denominations in circulation; anything else means a misread
INR_NOTES = {10, 20, 50, 100, 200, 500, 2000}
INR_COINS = {1, 2, 5, 10, 20}
TOLERANCE = 0.5
# value in words, longest first so "two hundred" wins over "hundred"
WORDS = [
    (2000, ["two thousand", "दो हज़ार", "दो हजार", "ਦੋ ਹਜ਼ਾਰ"]), (500, ["five hundred", "पांच सौ", "पाँच सौ", "ਪੰਜ ਸੌ"]),
    (200, ["two hundred", "दो सौ", "ਦੋ ਸੌ"]), (100, ["one hundred", "hundred", "एक सौ", "सौ", "ਸੌ"]),
    (50, ["fifty", "पचास", "ਪੰਜਾਹ"]), (20, ["twenty", "बीस", "ਵੀਹ"]), (10, ["ten", "दस", "ਦਸ"]),
]
DEV_DIGITS = str.maketrans("०१२३४५६७८९੦੧੨੩੪੫੬੭੮੯", "01234567890123456789")


def _numeral(s: str, valid: set) -> Optional[int]:
    nums = [int(n) for n in re.findall(r"\d+", s.translate(DEV_DIGITS).replace(",", "")) if int(n) in valid]
    return Counter(nums).most_common(1)[0][0] if nums else None


def _words(s: str) -> Optional[int]:
    s = " " + s.lower() + " "
    for value, words in WORDS:
        if any(re.search(r"(^|[^a-z])" + re.escape(w) + r"($|[^a-z])", s) if w.isascii() else w in s for w in words):
            return value
    return None


def decide(p: AIPiece) -> Tuple[Optional[float], bool, set]:
    """-> (value or None if conflicting, backed by printed evidence?, all values the evidence points to)."""
    valid = INR_NOTES if p.kind == "note" else INR_COINS
    seen = {v for v in (_numeral(p.numeral_seen, valid), _words(p.words_seen) if p.kind == "note" else None) if v is not None}
    if len(seen) > 1:
        return None, True, seen          # digits say one thing, words another
    if seen:
        return float(seen.pop()), True, {p.value}
    if p.value in valid and p.fully_visible:
        return float(p.value), False, {p.value}   # the model's call without readable print: weak
    return None, False, {p.value} if p.value in valid else set()


async def _read_cash(data: bytes, mime: str, lang: str):
    """Main model and the fast model read the photo at the same time; the second one is only a cross-check."""
    prompt = prompts.load("money", lang)
    main = gemini.ask(prompt, AICash, [(data, mime)], model=GEMINI_READ_MODEL, timeout=18)
    if GEMINI_MODEL == GEMINI_READ_MODEL:
        return await main, None
    second = gemini.ask(prompt, AICash, [(data, mime)], model=GEMINI_MODEL, timeout=12, fallback=False)
    a, b = await asyncio.gather(main, second, return_exceptions=True)
    if isinstance(a, BaseException):
        raise a
    return a, (None if isinstance(b, BaseException) else b)


def settle(main: AICash, second: Optional[AICash]):
    """-> (pieces with their values, unclear?, candidate values when unclear)."""
    decided = [(p, *decide(p)) for p in main.pieces]
    maybe: set = set()
    for p, value, backed, cands in decided:
        if value is None:
            maybe |= cands
    if second is not None:
        mine = sorted(v for _, v, _, _ in decided if v is not None)
        theirs = sorted(v for v, _, _ in (decide(q) for q in second.pieces) if v is not None)
        if mine != theirs:
            # the two readings differ: keep ours only if every piece is backed by printed digits or words
            if not all(backed and v is not None for _, v, backed, _ in decided):
                maybe |= set(Counter(mine) - Counter(theirs)) | set(Counter(theirs) - Counter(mine))
    pieces = [(p, v) for p, v, _, _ in decided if v is not None]
    return pieces, bool(maybe) or any(v is None for _, v, _, _ in decided), sorted(maybe)


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
    data, mime = await media.read_upload(image, max_side=1600)   # the digits on a note need detail
    main, second = await _read_cash(data, mime, lang)

    cur = (main.currency or "INR").strip().upper() or "INR"
    if cur != "INR":
        second = None  # the cross-check rules are for rupees
    pieces, unclear, maybe = settle(main, second)
    counts = Counter((p.kind, v) for p, v in pieces)
    items = [MoneyItem(value=v, kind=k, count=n) for (k, v), n in counts.items()]
    notes = [(p, v) for p, v in pieces if p.kind == "note"]

    state = session.get(session_id) or {}
    bill = bill_total if bill_total is not None else state.get("bill_total")
    m = lambda x: say_money(x, cur, lang)  # noqa: E731
    suspects = [SuspectNote(value=s.value, reason=s.reason) for s in main.suspicious] if cur == "INR" else []
    result = MoneyResult(mode=mode, speech="", currency=cur, items=items, bill_total=bill,
                         suspicious=suspects, unclear=unclear, maybe=maybe)
    warn = _fake_warnings(suspects, lang)  # safety first: fake warnings are always spoken before anything else

    if unclear and not suspects:
        if len(maybe) >= 2:   # "is it a 10 or a 20?": say exactly what is in doubt
            result.speech = t("money_which", lang, a=f"{maybe[0]:,.0f}", b=f"{maybe[1]:,.0f}")
        else:
            result.speech = t("money_unclear", lang)
        return result
    if not items:
        result.speech = t("money_none", lang)
        return result

    total = round(sum(i.value * i.count for i in items), 2)
    result.total = total
    head = t("money_total", lang, total=m(total)) + " " + _breakdown(items, cur, lang)

    if mode == "check":
        return _note_check(result, notes, suspects, warn, unclear, lang)
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


def _note_check(result: MoneyResult, notes: List[Tuple[AIPiece, float]], suspects, warn: str, unclear: bool, lang: str) -> MoneyResult:
    """Note check: which note it is, then the visible security features. Never says "genuine"."""
    if not notes:
        result.speech = t("money_none", lang)
        return result
    values = sorted((v for _, v in notes), reverse=True)
    if len(values) == 1:
        head = t("note_is", lang, value=f"{values[0]:,.0f}")
    else:
        head = t("notes_are", lang, n=len(values), values=", ".join(f"{v:,.0f}" for v in values))
    if suspects:
        result.speech = warn
        return result
    if unclear:
        result.speech = head + " " + t("money_unclear", lang)
        return result
    checks = [k for k, ok in (("rbi_text", all(p.rbi_text for p, _ in notes)), ("gandhi", all(p.gandhi_portrait for p, _ in notes)),
                              ("thread", all(p.security_thread for p, _ in notes))) if ok]
    result.checks = checks
    if any(p.side == "back" for p, _ in notes) or "gandhi" not in checks:
        result.speech = head + " " + t("check_turn", lang)
    elif len(checks) == 3:
        result.speech = head + " " + t("check_all", lang) + " " + t("check_bank", lang)
    else:
        result.speech = head + " " + t("check_some", lang) + " " + t("check_bank", lang)
    return result
