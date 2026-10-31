# Text-to-speech proxy (Sarvam) for hi / pa voices. Frontend falls back to Web Speech.
from fastapi import APIRouter, Form
from fastapi.responses import Response

router = APIRouter(tags=["tts"])


@router.post("/tts")
async def tts(text: str = Form(...), lang: str = Form("en")):
    # TODO: services.sarvam.speak(text, lang) -> audio bytes
    return Response(status_code=501, content=b"not implemented")
