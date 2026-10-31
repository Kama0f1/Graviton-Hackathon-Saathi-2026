from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import ALLOWED_ORIGINS
from .routers import navigate, read, guidance, tts

app = FastAPI(title="Saathi API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(navigate.router)
app.include_router(read.router)
app.include_router(guidance.router)
app.include_router(tts.router)


@app.get("/health")
def health():
    return {"ok": True}
