# Deploying Saathi on Vercel (backend + frontend)

The backend runs in Vercel's Mumbai region (`bom1`, set in `backend/vercel.json`) so it is close to Indian users.
Two Vercel projects from the **same GitHub repo**: one for `backend/`, one for `frontend/`.
Both get HTTPS (the phone camera needs it) and redeploy on every `git push`. Free Hobby plan, no card.

## 1. Backend project
1. vercel.com → sign in with GitHub → **Add New → Project** → import `Graviton-Hackathon-Saathi-2026`.
2. **Project Name**: `saathi-api`.
3. **Root Directory** → Edit → `backend`. Framework preset: **FastAPI** (or "Other"). Leave build settings empty.
   Vercel finds `backend/index.py` (which loads `app.main:app`) and installs `requirements.txt`.
4. **Environment Variables** (paste the values from your local `backend/.env`):
   | Name | Value |
   |---|---|
   | `GEMINI_API_KEY` | your key |
   | `SARVAM_API_KEY` | your key |
   | `GROQ_API_KEY` | your key (backup AI) |
   | `GEMINI_MODEL` | `gemini-flash-lite-latest` |
   | `GEMINI_GUIDANCE_MODEL` | `gemini-flash-lite-latest` |
   | `GEMINI_READ_MODEL` | optional. Default `gemini-flash-latest` (more accurate reading). Set to `gemini-flash-lite-latest` if reading feels slow |
   | `ALLOWED_ORIGINS` | `*` |
5. **Deploy**. Check `https://saathi-api.vercel.app/health` → `{"ok":true}`, and `/docs` opens Swagger.
   (Your URL may differ: copy it from the project page.)

## 2. Frontend project
1. **Add New → Project** → import the **same repo** again.
2. **Project Name**: `saathi`. **Root Directory** → `frontend`. Framework: **Vite** (auto).
3. **Environment Variables**: `VITE_API_URL` = the backend URL from step 1, e.g. `https://saathi-api.vercel.app` (no trailing slash).
4. **Deploy** → `https://saathi.vercel.app`.
   If you change `VITE_API_URL` later: Deployments → ⋯ → **Redeploy** (it is baked in at build time).

## 3. Phone
Open the frontend URL in **Chrome on Android** → allow camera + microphone → menu → **Add to Home screen / Install app**.
Then WhatsApp "Share → Saathi" works.

## How it copes with serverless
- Vercel may run each request on a different machine, so server memory is not reliable.
  The app sends back what it already knows: the document text with each question (`context`),
  and the bill total + amount paid with each money check. Server memory is only a fallback.
- Requests are limited to **4.5 MB**. The app shrinks big phone photos before upload
  (12 MB photo → about 1.7 MB) and says "file too big" for PDFs over 4 MB.
- Each backend call may run up to 60 s (`backend/vercel.json`). Normal calls take 2–8 s.
- First call after a quiet spell can take 2–3 s extra (cold start). Open `/health` before the pitch.

## Directions
Walking directions run on the phone (GPS + compass) using OpenStreetMap search (photon.komoot.io) and walking routes
(routing.openstreetmap.de). No key needed. The phone must allow **Location** for the site.

## Troubleshooting
| Problem | Fix |
|---|---|
| Red "can't reach the server" banner | `VITE_API_URL` wrong or missing → fix it, then Redeploy the frontend |
| Every answer is "Sorry, I couldn't do that" | Backend env vars missing → Settings → Environment Variables → add → Redeploy backend |
| Backend build fails | Deployments → the failed one → **Build Logs**; Root Directory must be `backend` |
| Live errors | Backend project → **Logs** tab |

## Before the pitch
- Open `/health` once to wake the backend.
- Phone hotspot ready in case venue Wi-Fi fails.
- Backup host (if Vercel misbehaves): Railway or Render with Root Directory `backend`,
  start `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (`railway.json` and `Procfile` are already there).
