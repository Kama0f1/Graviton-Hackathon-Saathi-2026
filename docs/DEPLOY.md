# Deploying Saathi

Backend (FastAPI) on **Railway**, frontend (Vite PWA) on **Vercel**. Both give HTTPS, which the phone camera needs.
Push everything to GitHub first; both services deploy straight from the repo.

## 1. Backend on Railway
1. railway.com → sign in with GitHub → **New Project → Deploy from GitHub repo** → `Graviton-Hackathon-Saathi-2026`.
2. Open the service → **Settings → Root Directory** = `backend`. (Start command comes from `backend/railway.json`.)
3. **Variables** tab → add:
   - `GEMINI_API_KEY` = your key
   - `SARVAM_API_KEY` = your key
   - `GROQ_API_KEY` = your key (backup AI, optional)
   - `GEMINI_MODEL` = `gemini-flash-lite-latest`
   - `GEMINI_GUIDANCE_MODEL` = `gemini-flash-lite-latest`
   - `ALLOWED_ORIGINS` = `*` (later: your Vercel URL)
4. **Settings → Networking → Generate Domain**. Open `https://<your-app>.up.railway.app/health` → `{"ok":true}`.

Fallback (free, no card): Render → New Web Service → repo, Root Directory `backend`, Build `pip install -r requirements.txt`,
Start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, same env vars. It sleeps after 15 min idle (first call ~1 min).

## 2. Frontend on Vercel
1. vercel.com → sign in with GitHub → **Add New → Project** → import the repo.
2. **Root Directory** = `frontend` (Framework: Vite, auto-detected).
3. **Environment Variables**: `VITE_API_URL` = `https://<your-app>.up.railway.app` (no trailing slash).
4. **Deploy** → you get `https://<name>.vercel.app`.
5. Optional: set Railway `ALLOWED_ORIGINS` to that Vercel URL.

## 3. Phone
Open the Vercel URL in **Chrome on Android** → allow camera → Chrome menu → **Add to Home screen / Install app**.
WhatsApp "Share → Saathi" works once installed.

## Before the pitch
- Open the backend `/health` once (Render: 1 minute before, to wake it).
- Phone hotspot ready in case venue Wi-Fi fails.
