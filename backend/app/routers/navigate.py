"""Navigate mode: /describe (scene), /sign (read a sign), /waste (item -> bin), /hazard (stairs, walls... while walking),
/findbin (where is the nearest dustbin)."""
import json
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile

from ..config import GEMINI_GUIDANCE_MODEL
from ..schemas import AIBinSpot, AIHazard, AIPlates, AIWaste, BinSpotResult, CabResult, HazardResult, SignResult, SpeechOnly, WasteResult
from ..services import gemini, groq, media, plates as plate_match, prompts
from ..services.errors import AIError
from ..services.phrases import t

router = APIRouter(tags=["navigate"])
RULES = json.loads((Path(__file__).resolve().parent.parent / "data" / "waste_rules.json").read_text(encoding="utf-8"))


@router.post("/describe", response_model=SpeechOnly)
async def describe(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    data, mime = await media.read_upload(image, max_side=768)  # 768 px = one Gemini image tile: fastest
    return await gemini.ask(prompts.load("describe", lang), SpeechOnly, [(data, mime)], timeout=12)


@router.post("/sign", response_model=SignResult)
async def sign(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    data, mime = await media.read_upload(image, max_side=1024)  # signs need a little more detail
    return await gemini.ask(prompts.load("sign", lang), SignResult, [(data, mime)], timeout=12)


@router.post("/waste", response_model=WasteResult)
async def waste(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    lang = prompts.lang_code(lang)
    data, mime = await media.read_upload(image, max_side=768)
    ai = await gemini.ask(prompts.load("waste", lang), AIWaste, [(data, mime)], timeout=12)

    # the rules file decides the bin, never the AI
    bin_color = RULES.get(ai.category, {}).get("bin_color") if ai.confident else None
    if bin_color:
        speech = f"{ai.item_spoken}. {t('cat_' + ai.category, lang)}. {t('bin_' + bin_color, lang)}."
    else:
        speech = f"{ai.item_spoken}. {t('bin_none', lang)}"
    speech = speech.replace("।.", "।").replace("..", ".")
    return WasteResult(
        speech=speech, item=ai.item, category=ai.category,
        bin_color=bin_color, confident=ai.confident,
    )


# drops and edges are what make people fall: warn about them earlier than about things to bump into
DROPS = {"stairs_down", "step_down", "kerb", "open_drain", "pothole"}


@router.post("/hazard", response_model=HazardResult)
async def hazard(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    """Called by the phone every few seconds while walking. Must be FAST: small image, Lite model, no backup
    on a slow answer (the next frame is already coming). The AI only names the hazard; Python builds the words."""
    lang = prompts.lang_code(lang)
    data, mime = await media.read_upload(image, max_side=512)
    prompt = prompts.load("hazard", lang)
    try:
        ai = await gemini.ask(prompt, AIHazard, [(data, mime)], model=GEMINI_GUIDANCE_MODEL, timeout=5, fallback=False)
    except AIError as exc:
        if "too long" in str(exc):
            return HazardResult(hazard="none")
        if "rate limit" in str(exc) and groq.available([(data, mime)]):
            ai = await groq.ask(prompt, AIHazard, [(data, mime)], timeout=5)
        else:
            raise
    metres = max(0.0, min(30.0, float(ai.metres)))
    metres = round(metres * 2) / 2 if metres < 2 else float(round(metres))  # 0.5 m steps when close
    if ai.hazard == "none" or metres > (7 if ai.hazard in DROPS else 4):
        return HazardResult(hazard="none")  # nothing, or still far away: not worth interrupting yet
    urgent = metres <= 1.5 or (ai.hazard in DROPS and metres <= 3)
    thing, pos = t("hz_" + ai.hazard, lang), t("pos_" + ai.position, lang)
    if metres < 0.5:
        speech = t("hz_now", lang, thing=thing, pos=pos)
    else:
        speech = t("hz_at", lang, thing=thing, pos=pos, d=say_metres(metres, lang))
    return HazardResult(hazard=ai.hazard, position=ai.position, metres=metres, urgent=urgent, speech=speech)


@router.post("/findbin", response_model=BinSpotResult)
async def findbin(image: UploadFile = File(...), lang: str = Form("en"), color: str = Form(""), session_id: str = Form("")):
    """Called by the phone every couple of seconds while the person turns, looking for a dustbin.
    `color` (blue/green/red) is the bin /waste asked for, if any. The AI only locates; Python builds the words."""
    lang = prompts.lang_code(lang)
    data, mime = await media.read_upload(image, max_side=640)
    want = f"They want the {color} bin, so prefer a {color} one if you see it." if color in ("blue", "green", "red") else ""
    prompt = prompts.load("findbin", lang, want=want)
    try:
        ai = await gemini.ask(prompt, AIBinSpot, [(data, mime)], model=GEMINI_GUIDANCE_MODEL, timeout=6, fallback=False)
    except AIError as exc:
        if "too long" in str(exc):
            return BinSpotResult(found=False, speech=t("bf_none", lang))
        if "rate limit" in str(exc) and groq.available([(data, mime)]):
            ai = await groq.ask(prompt, AIBinSpot, [(data, mime)], timeout=6)
        else:
            raise
    if not ai.found:
        return BinSpotResult(found=False, speech=t("bf_none", lang))
    metres = max(0.0, min(20.0, float(ai.metres)))
    metres = round(metres * 2) / 2 if metres < 2 else float(round(metres))
    thing = t("bf_col", lang, c=t("col_" + ai.color, lang)) if ai.color not in ("other",) else t("bf_bin", lang)
    if metres < 0.75:
        speech = t("bf_here", lang, thing=thing)
    else:
        speech = t("bf_at", lang, thing=thing, pos=t("pos_" + ai.position, lang), d=say_metres(metres, lang))
    return BinSpotResult(found=True, position=ai.position, metres=metres, color=ai.color, speech=speech)


@router.post("/cab", response_model=CabResult)
async def cab(image: UploadFile = File(...), plate: str = Form(...), lang: str = Form("en"), session_id: str = Form("")):
    """ "Is this my cab?": the AI reads the plates in view, Python matches them to the booked plate (tolerant of misreads)."""
    lang = prompts.lang_code(lang)
    data, mime = await media.read_upload(image, max_side=1280)  # plates are small: keep detail
    prompt = prompts.load("plates", lang)
    try:
        ai = await gemini.ask(prompt, AIPlates, [(data, mime)], model=GEMINI_GUIDANCE_MODEL, timeout=8, fallback=False)
    except AIError as exc:
        if "rate limit" in str(exc) and groq.available([(data, mime)]):
            ai = await groq.ask(prompt, AIPlates, [(data, mime)], timeout=8)
        else:
            raise
    readable = [v for v in ai.vehicles if len(plate_match.clean(v.plate)) >= 4]
    seen = [plate_match.clean(v.plate) for v in readable]
    for v in readable:
        if plate_match.same_plate(plate, v.plate):
            m = max(0.0, min(50.0, float(v.metres)))
            m = round(m * 2) / 2 if m < 2 else float(round(m))
            speech = t("cab_yes", lang, colour=v.colour, kind=t("veh_" + v.kind, lang), plate=plate_match.spoken(v.plate),
                       pos=t("pos_" + v.position, lang), d=say_metres(m, lang))
            return CabResult(match=True, plate=plate_match.clean(v.plate), plates=seen, position=v.position, metres=m, speech=speech)
    if readable:
        listed = ", ".join(plate_match.spoken(p) for p in seen[:3])
        return CabResult(plates=seen, speech=t("cab_no", lang, plates=listed))
    return CabResult(speech=t("cab_unread" if ai.vehicles else "cab_none", lang))


def say_metres(m: float, lang: str) -> str:
    """0.5 -> "less than 1 metre", 1 -> "1 metre", 1.5 -> "1.5 metres", 3 -> "3 metres" (Hindi/Punjabi add "par")."""
    if m < 1:
        return t("m_less", lang)
    if m == 1:
        return t("m_one", lang)
    return t("m_many", lang, n=f"{m:g}")
