"""Navigate mode: /describe (scene), /sign (read a sign), /waste (item -> bin)."""
import json
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile

from ..schemas import AIWaste, SignResult, SpeechOnly, WasteResult
from ..services import gemini, media, prompts
from ..services.phrases import t

router = APIRouter(tags=["navigate"])
RULES = json.loads((Path(__file__).resolve().parent.parent / "data" / "waste_rules.json").read_text(encoding="utf-8"))


@router.post("/describe", response_model=SpeechOnly)
async def describe(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    data, mime = await media.read_upload(image, max_side=1024)
    return await gemini.ask(prompts.load("describe", lang), SpeechOnly, [(data, mime)])


@router.post("/sign", response_model=SignResult)
async def sign(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    data, mime = await media.read_upload(image, max_side=1024)
    return await gemini.ask(prompts.load("sign", lang), SignResult, [(data, mime)])


@router.post("/waste", response_model=WasteResult)
async def waste(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    lang = prompts.lang_code(lang)
    data, mime = await media.read_upload(image, max_side=1024)
    ai = await gemini.ask(prompts.load("waste", lang), AIWaste, [(data, mime)])

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
