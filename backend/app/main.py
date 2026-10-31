import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from .config import ALLOWED_ORIGINS
from .routers import guidance, money, navigate, read, tts
from .services.errors import AIError, BadInput

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("saathi")

app = FastAPI(title="Saathi API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(navigate.router)
app.include_router(read.router)
app.include_router(money.router)
app.include_router(guidance.router)
app.include_router(tts.router)

SORRY = "Sorry, I couldn't do that. Please try again."


def _error(status: int, error: str, speech: str = SORRY) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": error, "speech": speech})


@app.exception_handler(BadInput)
async def bad_input(_: Request, exc: BadInput):
    return _error(400, str(exc), "I couldn't use that file. Please try again.")


@app.exception_handler(RequestValidationError)
async def bad_request(_: Request, exc: RequestValidationError):
    return _error(422, "Missing or invalid fields: " + "; ".join(e.get("msg", "") for e in exc.errors()))


@app.exception_handler(AIError)
async def ai_error(_: Request, exc: AIError):
    if "too long" in str(exc):
        return _error(504, str(exc), "That is taking too long. Please try again.")
    return _error(503, str(exc))


@app.exception_handler(Exception)
async def crash(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return _error(500, f"{type(exc).__name__}: {exc}")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")


@app.get("/health")
def health():
    return {"ok": True}
