# Camera framing guidance for Read mode. Must be FAST (~1.5 s). DUMMY for now.
from fastapi import APIRouter, File, Form, UploadFile

from ..schemas import GuidanceResult

router = APIRouter(tags=["guidance"])

PHRASES = {
    "left": "Move phone left.", "right": "Move phone right.", "up": "Move phone up.",
    "down": "Move phone down.", "closer": "Move closer.", "back": "Move back.",
    "hold": "Hold still.", "light": "Too dark. Find more light.", "none": "",
}


@router.post("/guidance", response_model=GuidanceResult)
async def guidance(image: UploadFile = File(...), target: str = Form("document"),
                   lang: str = Form("en"), session_id: str = Form("")):
    # TODO: cheap Gemini call returns {ready, move}; speech comes from PHRASES, not the model
    return GuidanceResult(ready=False, move="left", speech=PHRASES["left"])
