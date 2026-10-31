"""Text-to-speech via Sarvam (Hindi / Punjabi / Indian English). Returns audio/wav."""
from fastapi import APIRouter, Form
from fastapi.responses import Response

from ..services import sarvam
from ..services.errors import BadInput

router = APIRouter(tags=["tts"])


@router.post("/tts", response_class=Response, responses={200: {"content": {"audio/wav": {}}}})
async def tts(text: str = Form(...), lang: str = Form("en")):
    if not text.strip():
        raise BadInput("No text to speak")
    audio = await sarvam.speak(text.strip(), lang)
    return Response(content=audio, media_type="audio/wav")
