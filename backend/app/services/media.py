"""Reads an uploaded file, checks size and type, returns (bytes, mime_type)."""
import io
import logging
from typing import Tuple

from fastapi import UploadFile

from ..config import MAX_UPLOAD_MB
from .errors import BadInput

log = logging.getLogger("saathi.media")

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
PDF = "application/pdf"


def _sniff(data: bytes) -> str:
    if data[:4] == b"%PDF":
        return PDF
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return ""


def shrink(data: bytes, mime: str, max_side: int) -> Tuple[bytes, str]:
    """Resize big phone photos (3-5 MB) before sending them to Gemini: faster upload, faster answer.
    Anything Pillow cannot open (HEIC, odd formats) is passed through unchanged."""
    if mime == PDF or not max_side:
        return data, mime
    try:
        from PIL import Image, ImageOps

        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)  # respect phone rotation
        if max(img.size) <= max_side and len(data) < 1_500_000:
            return data, mime
        img.thumbnail((max_side, max_side))
        out = io.BytesIO()
        img.convert("RGB").save(out, "JPEG", quality=85)
        return out.getvalue(), "image/jpeg"
    except Exception as exc:  # never fail a request because of resizing
        log.info("resize skipped: %s", exc)
        return data, mime


async def read_upload(file: UploadFile, allow_pdf: bool = False, max_side: int = 1280) -> Tuple[bytes, str]:
    data = await file.read()
    if not data:
        raise BadInput("The uploaded file is empty")
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise BadInput(f"File is larger than {MAX_UPLOAD_MB:g} MB")

    mime = (file.content_type or "").lower()
    if mime not in IMAGE_TYPES and mime != PDF:
        mime = _sniff(data)  # phones sometimes send application/octet-stream
    if mime == PDF and not allow_pdf:
        raise BadInput("This endpoint takes an image, not a PDF")
    if mime not in IMAGE_TYPES and mime != PDF:
        raise BadInput("Unsupported file type (send JPEG, PNG, WebP or PDF)")
    return shrink(data, mime, max_side)
