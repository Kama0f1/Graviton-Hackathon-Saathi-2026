"""Entry point for Vercel (it looks for an `app` in index.py). Locally and on Railway: uvicorn app.main:app"""
from app.main import app  # noqa: F401
