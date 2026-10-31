# Saathi — GRAVITON 2026

An installable web app (PWA) that helps blind and low-vision users **navigate**, **sort waste**, and **read documents and bills** using only the phone camera, voice and vibration.

Submitted under **PS #13 (NaviAble)**, extended with #18 (documents), #22 (waste) and #25 (bills).

## Modes

| Mode | What it does |
| --- | --- |
| Navigate | Obstacle warnings (on-device), scene description, sign reading, waste item -> correct bin + bin finder |
| Read | Documents and bills read aloud, Q&A on the last document, bill overcharge check |

## Team

| Role | Folder | Stack |
| --- | --- | --- |
| Frontend | `frontend/` | Vite, React, TypeScript, vite-plugin-pwa, TF.js COCO-SSD, Web Speech, Vibration, Web Audio |
| Backend | `backend/` | Python, FastAPI, Gemini Flash (google-genai), PyMuPDF, Sarvam, Pydantic |
| Pitch & PPT | `docs/`, `demo/` | Google Slides / Canva, CapCut / Clipchamp, scrcpy |

Rule: nobody edits another role's folder. The API contract (`backend/app/schemas/`) changes only if frontend and backend both agree.

## Run locally

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy ..\.env.example .env     # then fill in the keys
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host
```

The phone camera needs HTTPS: `cloudflared tunnel --url http://localhost:5173` in dev, Vercel (frontend) + Render/Railway (backend) for the demo.
