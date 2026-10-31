# Saathi backend (FastAPI)

## Setup (Windows)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example .env
```

Put your `GEMINI_API_KEY` (and `SARVAM_API_KEY` for Hindi/Punjabi voice) in `backend/.env`.

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000/docs: every endpoint can be tried there by uploading a photo.

## Test (no API key needed)

```bash
pytest -q
```

## Endpoints

| Endpoint | Sends (form-data) | Returns |
| --- | --- | --- |
| `POST /describe` | `image`, `lang`, `session_id` | `{speech}` |
| `POST /sign` | `image`, `lang`, `session_id` | `{speech, text, confident}` |
| `POST /waste` | `image`, `lang`, `session_id` | `{speech, item, category, bin_color, confident}` |
| `POST /guidance` | `image`, `target`, `lang`, `session_id` | `{ready, move, speech}` |
| `POST /read` | `file` (image or PDF), `lang`, `session_id` | `{kind, speech, speech_more, doc_type, key_fields, bill, uncertain}` |
| `POST /read/ask` | `question`, `lang`, `session_id` | `{speech}` |
| `POST /tts` | `text`, `lang` | `audio/wav` |

`lang` is `en`, `hi` or `pa`. Errors always return `{error, speech}` so the phone can still say something.
