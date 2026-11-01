# Saathi: a talking camera for blind and low-vision people

**GRAVITON 2026 · PS #13 NaviAble**, extended with #18 (documents), #22 (waste sorting) and #25 (bills).

Saathi is an app you install from the browser (a PWA). Point the phone camera and it tells you what is in front of you,
how far away it is, and what is written on it, in **English, Hindi or Punjabi**. You can use it by voice, by touch, or both.
It answers by voice and vibration, so it works without looking at the screen.

- **Backend health check:** https://saathibackend.vercel.app/health (should show `{"ok":true}`)
- **Live app:** _https://saathifrontend.vercel.app/_
- **Voice commands:** [docs/VOICE_COMMANDS.md](docs/VOICE_COMMANDS.md) · **Deploying:** [docs/DEPLOY.md](docs/DEPLOY.md)

---

## What it does

### Navigate (the camera is always watching)
| Feature | What you hear |
|---|---|
| **Obstacle alerts** (on the phone, works offline) | "Chair ahead, 1.5 metres", plus vibration that gets stronger as you get closer |
| **Stairs, walls, kerbs, glass, potholes** | "Stairs going down ahead, 3 metres", with an urgent buzz for drops |
| **What's ahead** | The path first, then hazards with distances |
| **Read a sign** | Any signboard, read aloud |
| **Which bin** | Wet, dry or hazardous, and the bin colour |
| **Find the bin** | "Bin on your left, 3 metres … right in front of you. Reach out." |
| **Walking directions** | "In 30 metres, turn right onto Market Road", re-routes if you drift off the route |
| **Where am I** | Street name and nearest landmark |
| **Is this my cab?** | Reads number plates: "That is your cab: white car, P B 65 A B 12 34, ahead, 6 metres" |

### Read
| Feature | What you hear |
|---|---|
| **Documents and PDFs** | What it is and the one thing that matters ("Electricity bill, 1,240 rupees, due 10 November") |
| **Shop bills** | Total, items, and an **overcharge warning** (Python adds up the items, never the AI) |
| **Price tags and food packets** | Name, MRP, best-before date, and a clear warning if it has **expired** |
| **Ask** | Questions about the last page you scanned |
| **Count money and check change** | "Total 1,500 rupees. You should get 401 back" … "Correct change" |
| **Note check** | Which note it is, and whether it shows obvious signs of a fake (it never says a note is genuine) |
| **UPI QR safety check** | Who the QR really pays; warns if it isn't the shop on your bill, asks for the wrong amount, or isn't a payment QR at all |
| **Share from WhatsApp** | Share an image or PDF to Saathi and it reads it |

### Safety
- **SOS:** say "help me", "emergency" or "bachao", or shake the phone 3 times. The whole screen becomes one button;
  tap anywhere and your live Google Maps location goes to your emergency contact on WhatsApp or by SMS.
- **Works offline:** obstacle alerts, distances and vibration keep working without internet, and the app says so.

### Made for blind users, not just about them
- Voice in 3 languages, with a parser that copes with misheard words ("where is the ben" still finds the bin).
- Speech stays calm: the newest answer replaces older ones and stale updates are dropped, so it never talks over itself.
- Big touch targets (48 px or more), and colour is never the only signal.
- The **Say** tab lists every voice command; tap one to try it.

---

## How it works

```
 Phone (React PWA)                                          Backend (FastAPI on Vercel, Mumbai)
 ─────────────────                                          ───────────────────────────────────
 Camera ─► COCO-SSD (TensorFlow.js, on the phone) ─► obstacle alerts, metres, vibration (offline)
 Camera ─► QR decode on the phone ─► UPI safety check (offline)
 GPS + compass ─► OpenStreetMap (Photon, OSRM) ─► walking directions
 Camera / file ─────────────────────────────────────────►  Gemini Flash / Flash Lite (vision)
                                                            ├─ the AI only describes what it sees
                                                            ├─ Python does every sum, check and sentence
                                                            └─ Groq backup if Gemini hits its rate limit
 Voice in: Web Speech (5 guesses, own en/hi/pa parser)      Voice out: Sarvam Bulbul v3 (Hindi, Punjabi)
```

**How it stays accurate**
- **Notes:** the AI must first write down the digits and words printed on each note, and the value comes from that.
  Two models read every money photo; if they disagree it asks "is it a 10 or a 20?" instead of guessing.
- **Bills:** if the items add up to the printed total, the reading is trusted. If not, the AI takes a slower second look.
  Two matching readings mean a real overcharge.
- **Plates:** matching tolerates one misread character (B read as 8, O as 0).
- **Obstacles:** something must be seen in 2 of 3 frames before it is spoken. A poster on a wall isn't called a fridge.

### Tech stack
| Part | Built with |
|---|---|
| App | React 19, TypeScript, Vite 8, PWA (service worker, share target) |
| On-phone AI | TensorFlow.js 4.22 with COCO-SSD Lite; QR codes via BarcodeDetector with jsQR as fallback |
| Voice | Web Speech API (input), Sarvam AI Bulbul v3 + phone voice (output) |
| Maps | OpenStreetMap: Photon / Nominatim (search), OSRM (walking routes); no API key needed |
| Backend | Python, FastAPI, Pydantic v2, Pillow, httpx |
| Vision AI | Google Gemini Flash and Flash Lite (google-genai), Groq as backup |
| Hosting | Vercel (Mumbai region, HTTPS) |
| Tests | pytest (backend), a voice parser check, an accuracy script for real photos |

---

## Set it up

### What you need
- Python 3.11 or newer, Node.js 20 or newer
- A free **Gemini API key** from https://aistudio.google.com/apikey (required)
- A **Sarvam AI key** from https://dashboard.sarvam.ai (for Hindi/Punjabi voices; without it the phone's own voice is used)
- A **Groq key** from https://console.groq.com/keys (optional backup when Gemini is busy)
- **Chrome on Android** to use the app (the camera and microphone need HTTPS or localhost)

### 1. Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows    (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy ..\.env.example .env         # Windows    (macOS/Linux: cp ../.env.example .env)
# open backend/.env and paste your keys
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Check http://localhost:8000/health shows `{"ok":true}`. http://localhost:8000/docs lists every endpoint.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev -- --host
```
Open http://localhost:5173. In development the app reaches the backend on port 8000 through Vite's `/api` proxy,
so nothing else to set. A phone needs HTTPS for the camera: deploy it (below), or run
`cloudflared tunnel --url http://localhost:5173` and open the link it prints (one tunnel covers both, thanks to the proxy).

### 3. Deploy (free, about 10 minutes)
Two Vercel projects from this repo: Root Directory `backend` and Root Directory `frontend`.
Step-by-step guide: [docs/DEPLOY.md](docs/DEPLOY.md).

| Backend environment variable | Value |
|---|---|
| `GEMINI_API_KEY` | your key (required) |
| `SARVAM_API_KEY` | your key |
| `GROQ_API_KEY` | your key (optional backup) |
| `GEMINI_MODEL`, `GEMINI_GUIDANCE_MODEL` | `gemini-flash-lite-latest` |
| `GEMINI_READ_MODEL` | `gemini-flash-latest` (more accurate reading of bills and money) |
| `ALLOWED_ORIGINS` | `*` |

Frontend environment variable: `VITE_API_URL` = your backend URL, no trailing slash. Redeploy the frontend after changing it.

### 4. On the phone
Open the frontend link in Chrome → allow camera, microphone and location → menu → **Add to Home screen**.
Then in **Settings**, add an emergency contact for SOS.

---

## Test it
```bash
cd backend
python -m pytest -q                                       # 68 tests: bills, money, change, hazards, bins, cabs, errors
python eval/accuracy.py path/to/photos --url https://saathibackend.vercel.app   # accuracy on your own photos
```
- **Accuracy script:** name photos by what is really in them (`note_10_a.jpg`, `cash_500-100-10_b.jpg`, `bill_1199_c.jpg`)
  and it prints how many it got right.
- **UPI QR test:** open [demo/qr-test-sheet.html](demo/qr-test-sheet.html) on a laptop and point the app at each QR.
  The UPI IDs on it are made up, so nobody can pay with them by accident.

---

## Troubleshooting
| Problem | Fix |
|---|---|
| Every answer is "Sorry, I couldn't do that" | The AI call failed. On Vercel → backend project → **Logs**. Usually the Gemini key is missing or wrong, or the free daily quota is used up: add `GROQ_API_KEY` as a backup, or use another key |
| "Not connected to the Saathi server" | `VITE_API_URL` is wrong or missing → fix it and redeploy the frontend. The first call after a quiet spell can take a few seconds (the free server wakes up) |
| Camera or mic don't start | The page must be HTTPS (or localhost); allow camera and microphone in Chrome's site settings |
| Hindi/Punjabi sound robotic | `SARVAM_API_KEY` is missing, so the phone's own voice is used |
| Directions don't work | Allow **Location** for the site, and stand outdoors for a GPS fix |
| Obstacle alerts never start | The detection model downloads once on first use; it needs internet that one time |

## Honest limits
- A phone photo can't check a note's watermark or UV features. Saathi only catches **obvious** fakes and always says to check big amounts at a bank.
- Distances are estimates from the camera, rounded to half a metre up close and whole metres further away.
- SOS needs one tap to send, because a website isn't allowed to send messages by itself.
- Photos are sent to the AI to be read and are not stored by Saathi.

## Folder map
```
backend/   FastAPI app: routers (navigate, read, money, guidance, tts), prompts, schemas, tests, eval
frontend/  React PWA: modes (Navigate, Read, Say, Settings), vision (obstacles, hazards, bins, cabs, QR), core (speech, voice, routes)
docs/      deploy guide, voice commands, project context, pitch
demo/      demo checklist and the QR test sheet
```
