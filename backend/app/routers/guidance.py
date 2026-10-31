"""Camera framing for Read mode. Must be FAST: small image, Lite model, fixed phrases."""
from fastapi import APIRouter, File, Form, UploadFile

from ..config import GEMINI_GUIDANCE_MODEL
from ..schemas import AIGuidance, GuidanceResult
from ..services import gemini, groq, media, prompts
from ..services.errors import AIError
from ..services.phrases import t

router = APIRouter(tags=["guidance"])


@router.post("/guidance", response_model=GuidanceResult)
async def guidance(
    image: UploadFile = File(...),
    target: str = Form("document"),
    lang: str = Form("en"),
    session_id: str = Form(""),
):
    # "document" also covers product labels and price tags on packets (the text area on them is small)
    target = "bill" if target == "bill" else "document, bill, product label or price tag"
    data, mime = await media.read_upload(image, max_side=768)
    try:
        ai = await gemini.ask(
            prompts.load("guidance", lang, target=target), AIGuidance,
            [(data, mime)], model=GEMINI_GUIDANCE_MODEL, timeout=6, fallback=False,  # a backup call would be too slow for live framing
        )
    except AIError as exc:
        if "too long" in str(exc):
            # a slow frame is not an error: say nothing, the phone just sends the next frame
            return GuidanceResult(ready=False, move="none", speech="")
        if "rate limit" in str(exc) and groq.available([(data, mime)]):
            # free-tier limit: this error comes back instantly, so the backup still answers in time
            ai = await groq.ask(prompts.load("guidance", lang, target=target), AIGuidance, [(data, mime)], timeout=5)
        else:
            raise
    move = "hold" if ai.ready else ai.move
    return GuidanceResult(ready=ai.ready, move=move, speech=t("move_" + move, lang))
