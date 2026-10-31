# Read mode endpoints. Currently return DUMMY data matching the contract.
from fastapi import APIRouter, File, Form, UploadFile

from ..schemas import Bill, BillItem, ReadResult, SpeechOnly

router = APIRouter(tags=["read"])


@router.post("/read", response_model=ReadResult)
async def read(file: UploadFile = File(...), lang: str = Form("en"), session_id: str = Form("")):
    # TODO: pdf.py -> page images; gemini classifies document vs bill + extracts;
    #       bill_check.py does the maths; session.py stores the text for /read/ask
    return ReadResult(
        kind="bill",
        speech="Ramesh Traders. 3 items. Total 4,830 rupees. Warning: the items add up to 4,350, but the total says 4,830.",
        speech_more="Atta, 5 packets, 2,200 rupees.",
        bill=Bill(shop="Ramesh Traders",
                  items=[BillItem(name="Atta", qty=5, unit="packet", amount=2200)],
                  printed_total=4830, computed_total=4350, mismatch=True),
    )


@router.post("/read/ask", response_model=SpeechOnly)
async def ask(question: str = Form(...), lang: str = Form("en"), session_id: str = Form("")):
    # TODO: session.get(session_id) -> gemini answers from stored text only
    return SpeechOnly(speech="Yes, payment is due on 10 November. The amount is 1,240 rupees.")
