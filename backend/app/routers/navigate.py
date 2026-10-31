# Navigate mode endpoints. Currently return DUMMY data matching the contract.
from fastapi import APIRouter, File, Form, UploadFile

from ..schemas import SpeechOnly, SignResult, WasteResult

router = APIRouter(tags=["navigate"])


@router.post("/describe", response_model=SpeechOnly)
async def describe(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    # TODO: services.gemini.ask(image, prompts/describe.txt, SpeechOnly)
    return SpeechOnly(speech="A classroom door on your left, a person walking toward you.")


@router.post("/sign", response_model=SignResult)
async def sign(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    # TODO: prompts/sign.txt
    return SignResult(speech="Exit. Gate 2.", text="EXIT GATE 2", confident=True)


@router.post("/waste", response_model=WasteResult)
async def waste(image: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    # TODO: Gemini picks category; data/waste_rules.json decides bin_color
    return WasteResult(speech="Plastic bottle. Dry waste. Blue bin.", item="plastic bottle",
                       category="dry", bin_color="blue", confident=True)
