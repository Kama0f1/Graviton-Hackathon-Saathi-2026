"""In-memory store: session_id -> last document read, so /read/ask can answer follow-ups.
Lost on server restart, which is fine for a demo."""
import time
from typing import Optional

from ..config import SESSION_TTL_HOURS

_TTL = SESSION_TTL_HOURS * 3600
_store: dict = {}


def _purge() -> None:
    now = time.time()
    for sid in [s for s, (t, _) in _store.items() if now - t > _TTL]:
        _store.pop(sid, None)


def save(session_id: str, data: dict) -> None:
    if not session_id:
        return
    _purge()
    _store[session_id] = (time.time(), data)


def update(session_id: str, **fields) -> None:
    """Add or change fields without wiping the saved document."""
    if not session_id:
        return
    data = dict(get(session_id) or {})
    data.update(fields)
    save(session_id, data)


def get(session_id: str) -> Optional[dict]:
    if not session_id:
        return None
    _purge()
    item = _store.get(session_id)
    return item[1] if item else None
