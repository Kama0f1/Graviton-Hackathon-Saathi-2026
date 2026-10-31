# Saathi frontend (React + Vite PWA)

Mobile-first app for blind and low-vision users: Navigate (obstacles, signs, waste, bin finder) and
Read (documents, bills + overcharge check, money count / change / fake-note check).

## Run (laptop)
```
npm install
npm run dev
```
Open http://localhost:5173 in Chrome. The backend must be running on http://127.0.0.1:8000
(`uvicorn app.main:app --host 0.0.0.0 --port 8000` in `backend/`). Calls go to `/api/...`
and the Vite dev server forwards them to the backend (see `vite.config.ts`), so no CORS or URL setup.

## Run on a phone
The camera needs HTTPS. Easiest: `cloudflared tunnel --url http://localhost:5173` and open the
https URL it prints in Chrome on the phone. Only ONE tunnel is needed (the backend is reached via /api).

## Where things are
- `src/App.tsx`: shell, top bar, language switch, home cards, bottom dock (caption, mic, repeat, stop)
- `src/modes/NavigateMode.tsx`, `src/modes/ReadMode.tsx`: the two modes
- `src/core/`: `api.ts` (backend client), `speech.ts` (priority speech queue; alerts interrupt, answers resume),
  `listen.ts` (voice commands en/hi/pa), `camera.ts`, `guidance.ts` (guided capture), `audio.ts`, `haptics.ts`, `result.ts`
- `src/vision/`: `objectDetection.ts` + `detector.ts` (COCO-SSD obstacle alerts), `binFinder.ts` (colour bin finder)
- `src/i18n/phrases.ts`: every app sentence in English, Hindi, Punjabi
- `public/manifest.webmanifest`, `public/sw.js`, `public/icons/`: installable app + WhatsApp share target
