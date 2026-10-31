"""Loads prompt files from app/prompts and fills in placeholders like {lang}."""
from functools import lru_cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"
LANG_NAMES = {"en": "English", "hi": "Hindi", "pa": "Punjabi"}


def lang_code(lang: str) -> str:
    """Normalise whatever the phone sends to en / hi / pa (default en)."""
    lang = (lang or "en").strip().lower()[:2]
    return lang if lang in LANG_NAMES else "en"


@lru_cache(maxsize=None)
def _read(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.txt").read_text(encoding="utf-8")


def load(name: str, lang: str = "en", **values) -> str:
    """load("read", "hi") -> the read prompt with {lang} = Hindi. Extra values fill {key} placeholders."""
    text = _read(name).replace("{lang}", LANG_NAMES[lang_code(lang)])
    for key, value in values.items():
        text = text.replace("{" + key + "}", str(value))
    return text
