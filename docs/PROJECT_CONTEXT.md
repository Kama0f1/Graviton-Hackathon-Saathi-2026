# Saathi: full project context (start here for frontend work)

> Paste or attach this file at the start of a new chat. It describes the project, what is already built (the backend is done and tested), the exact API, and what the frontend must do.

## 1. The project in one paragraph

**Saathi** ("companion") is an installable web app (PWA) that lets a **blind or low-vision person** move around safely, sort their waste, read any document or bill, and **not get cheated with money**, using only the phone camera, voice and vibration. The user never has to look at the screen. Built for **GRAVITON 2026** (CGC University, Mohali, 24-hour hackathon, 31 Oct – 1 Nov 2026). Submitted under **PS #13 (NaviAble: assistive navigation for visually impaired users)**, extended with ideas from PS #18 (documents), #22 (waste) and #25 (bills).

**Judging:** idea, how well it is pitched, the solution, the tech stack, demo readiness.

**Pitch line:** *"Lookout tells you what a bill says. Saathi tells you if you're being cheated."* Free apps (Google Lookout, RBI's MANI) already read text and identify notes; Saathi's edge is that it **checks and decides**: overcharged bills, short change, obvious fake notes, which bin, plus Hindi/Punjabi.

**Team:** Kama (Aditya), backend · a friend, frontend · a third teammate, pitch deck.
**Repo:** https://github.com/Kama0f1/Graviton-Hackathon-Saathi-2026 · local: `D:\Aditya\Hackathon\Graviton`

## 2. Features and status

### Navigate mode (moving around)
| Feature | User hears / feels | Status |
| --- | --- | --- |
| Obstacle warnings | Beeps get faster as something gets closer + "Chair ahead, close". Offline, on the phone. Covers waist/head-height things a cane misses | **Frontend to build** (TF.js COCO-SSD on device) |
| Scene description | "A door on your left, a person coming toward you" | Backend done: `POST /describe` |
| Sign reading | "Exit. Gate 2." | Backend done: `POST /sign` |
| Waste: which bin | "Plastic bottle. Dry waste. Blue bin." | Backend done: `POST /waste` |
| Bin finder | Beeps guide you toward the blue/green bin | **Frontend to build** (colour blob tracking) |

### Read mode (paper and money)
| Feature | User hears | Status |
| --- | --- | --- |
| Camera guidance | "Move phone left… hold still" → auto-captures | Backend done: `POST /guidance`; **frontend runs the loop** |
| Document reading | Type + key point; "more" = full text | Backend done: `POST /read` |
| Questions about the document | "When is it due?" → "10 November" | Backend done: `POST /read/ask` |
| Bill reading + **overcharge check** | "Items add up to 4,350 rupees, but the total says 4,830" | Backend done: `POST /read` |
| **Count money** | "Total 500 rupees. You should get 70 rupees back." | Backend done: `POST /money mode=count` |
| **Change check** | "You should get 70 rupees, but you got 50. 20 rupees short." | Backend done: `POST /money mode=change` |
| **Fake-note alert** | "The 500 rupee note may be fake… Do not accept it." Never claims "genuine" | Backend done: `POST /money mode=check` (+ runs inside count/change) |
| Share from WhatsApp | Share a PDF/photo into Saathi | **Frontend to build** (Web Share Target) |

### Whole app
| Feature | Status |
| --- | --- |
| English, Hindi, Punjabi (`lang` = `en` / `hi` / `pa`) | Backend done |
| Natural Indian voice | Backend done: `POST /tts` (Sarvam); phone voice as fallback |
| Voice commands, 2-half TalkBack screen, vibration patterns, install to home screen | **Frontend to build** |

## 3. How a blind person uses it (the UX spec)

- **Open:** "Hey Google, open Saathi" or tap the home-screen icon (TalkBack). Opens straight into the camera and says "Saathi ready. Navigate mode."
- **Install once:** open the link in Chrome on Android → app says "Install Saathi to your home screen?" → one double-tap. Then it opens full-screen, sits in the app drawer, and appears in WhatsApp's share menu.
- **Screen:** two huge halves. **Top = Navigate, bottom = Read.** With TalkBack: touch = hear the label, double-tap = activate. Without TalkBack: single tap.
- **Voice:** hold anywhere and speak: "what's in front of me", "read sign", "what bin", "read this", "read bill", "count money", "check change", "check note", "more", "repeat", "stop". Any other sentence in Read mode = a question → `/read/ask`.
- **Feedback without looking:** 1 buzz = Navigate, 2 buzzes = Read. Obstacle/bin beeps speed up as you get closer. Soft tick while waiting for the server.
- **Camera guidance:** the app talks the user into framing the paper and takes the photo itself (shutter sound).
- **Speech priority:** obstacle warnings interrupt everything. Short answer first; "more" for detail. Don't repeat the same object within 3 s. Fake-note warnings are always said first (the backend already puts them first).
- **Walking:** phone in a chest lanyard / shirt-pocket clip, camera facing forward (the cane is in the other hand).
- **Language:** en / hi / pa toggle; sent as `lang` on every request.

## 4. Architecture

```
Phone (React PWA)                           FastAPI backend (Python)                 External
- camera, TF.js obstacles (offline)  --->   routers: /describe /sign /waste    --->  Gemini Flash-Lite (vision -> JSON)
- voice in/out, beeps, vibration     <---   /guidance /read /read/ask /money        Groq qwen vision (automatic backup)
- sends photo + lang + session_id           /tts                                     Sarvam Bulbul v3 (hi/pa voice)
                                            services: gemini, groq, bill_check,
                                            session, phrases (fixed en/hi/pa text)
```

**Design rule: the AI reads, Python decides.** Gemini only extracts what it sees. Python adds up bills and money, picks the bin from a rules file, and speaks fixed phrases for guidance/warnings. So the AI can't invent a wrong total or bin. Obstacle detection never touches the backend.

## 5. Backend: how to run it

```
cd /d D:\Aditya\Hackathon\Graviton\backend
.venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Interactive API docs: http://127.0.0.1:8000/docs (`/` redirects there). Health: `GET /health` → `{"ok": true}`.
- Keys live only in `backend/.env` (gitignored): `GEMINI_API_KEY`, `SARVAM_API_KEY`, `GROQ_API_KEY` (backup), models `GEMINI_MODEL=gemini-flash-lite-latest`. `python check_keys.py` tests all keys.
- Tests: `pytest -q` (37 unit tests, AI faked) · `python live_test.py` (end-to-end against the running server with real AI; last run 21/21 pass, ~1.8 s average).
- On Windows use `127.0.0.1`, not `localhost` (localhost adds ~2 s per call).
- CORS is open (`ALLOWED_ORIGINS=*`); set it to the frontend URL when deployed.
- **Phone access during development:** the phone camera needs HTTPS. Run the frontend dev server and expose it with `cloudflared tunnel --url http://localhost:5173`; expose the backend the same way (port 8000) and put that URL in `frontend/.env` as `VITE_API_URL`.
- **Rate limits:** the free Gemini tier caps requests per minute. Groq takes over automatically on rate limits. Keep camera-guidance frames to about one every 1.5–2 s and only while Read mode is actively capturing.

## 6. API contract (exact, implemented)

All requests are `multipart/form-data`. Always send `lang` (`en`/`hi`/`pa`) and `session_id` (a UUID the app creates once at start and keeps). Images: JPEG/PNG/WebP (the server also shrinks them; still compress on the phone to ~1024 px, ~512–768 px for `/guidance`, to save upload time). Max 15 MB.

**Every response has a ready-to-speak `speech` string. The frontend just speaks it.**

**Errors** (any endpoint): HTTP 4xx/5xx with `{"error": "...", "speech": "..."}`. Speak `speech`.
- 400 bad file · 422 missing field · 503 AI unavailable · 504 "That is taking too long. Please try again."

| Endpoint | Mode | Form fields | Returns |
| --- | --- | --- | --- |
| `POST /describe` | Navigate | `image` | `{speech}` |
| `POST /sign` | Navigate | `image` | `{speech, text, confident}` |
| `POST /waste` | Navigate | `image` | `{speech, item, category, bin_color, confident}` |
| `POST /guidance` | Read | `image`, `target` (`document` or `bill`) | `{ready, move, speech}` |
| `POST /read` | Read | `file` (image **or PDF**) | `ReadResult` (below) |
| `POST /read/ask` | Read | `question` (text) | `{speech}` |
| `POST /money` | Read | `image`, `mode` (`count` / `change` / `check`), optional `paid`, optional `bill_total` | `MoneyResult` (below) |
| `POST /tts` | Both | `text` | `audio/wav` bytes (Sarvam). If it fails, use the phone's Web Speech voice |

```jsonc
// /waste
{ "speech": "Plastic bottle. Dry waste. Blue bin.", "item": "plastic bottle",
  "category": "dry",            // wet | dry | hazardous | unknown
  "bin_color": "blue",          // green | blue | red | null  -> start the bin finder for this colour
  "confident": true }

// /guidance  (send every ~1.5–2 s while framing)
{ "ready": false,
  "move": "left",               // left right up down closer back hold light none
  "speech": "Move phone left." } // "" = say nothing (slow frame), just send the next one
// capture rule: take the full-resolution photo after ready == true twice in a row

// /read, kind = "document"
{ "kind": "document", "doc_type": "electricity bill",
  "speech": "This is your electricity bill ... 1,240 rupees due on 10 November 2026.",
  "speech_more": "<full text>",           // speak on "more"
  "key_fields": { "due_date": "10 November 2026", "amount": "1,240" },
  "bill": null, "uncertain": [] }

// /read, kind = "bill"
{ "kind": "bill", "doc_type": "shop bill",
  "speech": "Sharma Kirana Store. 4 items. Total 1,199 rupees. Warning: the items add up to 1,099 rupees, but the total says 1,199 rupees.",
  "speech_more": "Atta 10kg, 450 rupees. Toor Dal 1kg, 2, 320 rupees. ...",
  "key_fields": {},
  "bill": { "shop": "Sharma Kirana Store", "currency": "INR",
            "items": [ { "name": "Atta 10kg", "qty": 1, "unit": null, "amount": 450 } ],
            "printed_total": 1199, "computed_total": 1099, "mismatch": true },
  "uncertain": [] }              // may contain "printed_total", "items", "multiple_bills"

// /money  mode = count | change | check
{ "mode": "change",
  "speech": "You should get 70 rupees, but you got 50 rupees. 20 rupees short.",
  "currency": "INR", "total": 50,
  "items": [ { "value": 50, "kind": "note", "count": 1 } ],
  "bill_total": 430, "paid": 500, "expected_change": 70, "difference": -20,
  "suspicious": [ { "value": 500, "reason": "toy_text" } ],   // not_rbi | toy_text | photocopy | mismatch | other
  "unclear": false }
```

**Money flow (session-based, same `session_id`):**
1. `POST /read` a bill → server remembers the bill total.
2. User says "count money", holds up the notes they will pay → `POST /money mode=count` → "You should get 70 rupees back." (server remembers paid).
3. User says "check change", holds up the change → `POST /money mode=change` → correct / short / extra.
4. "check note" → `POST /money mode=check` → obvious-fake warning or "No obvious signs of a fake… check large amounts with a bank."
If the user says the paid amount instead of photographing it, send `paid` with `mode=change`.

## 7. Frontend: what exists and what to build

Scaffold already in `frontend/` (stubs with comments, not implemented): Vite + React + TypeScript + vite-plugin-pwa.

```
frontend/
  vite.config.ts        PWA manifest (standalone, portrait, icons 192/512/maskable) + share_target POST /share (images + PDFs)
  index.html, package.json (react 18, @tensorflow/tfjs, @tensorflow-models/coco-ssd, vite-plugin-pwa), tsconfig.json
  .env.example          VITE_API_URL=http://localhost:8000
  public/icons/         NEED icon-192.png, icon-512.png, icon-maskable-512.png (Chrome won't offer install without them)
  public/sounds/        beep, tick, shutter, mode-switch
  public/models/        self-hosted COCO-SSD model files (offline; venue Wi-Fi must not break obstacles)
  src/
    App.tsx             2-half screen (top Navigate, bottom Read), mode switch, hold-anywhere voice
    sw.ts               service worker: precache shell + sounds + model; handle POST /share -> Read mode
    modes/NavigateMode.tsx   obstacles loop, describe/sign/waste actions, bin finder
    modes/ReadMode.tsx       guidance loop + auto-capture -> /read; "more"; questions -> /read/ask; money count/change/check
    components/CameraView.tsx, HalfButton.tsx (aria-label, aria-pressed), LiveAnnouncer.tsx (aria-live)
    core/speech.ts      TTS queue with priority: obstacle > answer > info; "stop" clears; "repeat" replays; /tts for hi/pa, Web Speech fallback
    core/listen.ts      Web Speech recognition + command parser (commands listed in section 3)
    core/haptics.ts     vibration patterns (1 buzz Navigate, 2 buzzes Read, proximity pulses)
    core/audio.ts       Web Audio beeps; rate rises with closeness; tick while waiting; shutter
    core/camera.ts      rear camera getUserMedia, grab frame to canvas, JPEG compress
    core/guidance.ts    framing loop against /guidance, ready-twice -> capture
    core/api.ts         all backend calls; base URL from VITE_API_URL; adds lang + session_id; speaks error.speech
    vision/detector.ts  COCO-SSD every ~200 ms, keep big boxes (person, chair, bench, car, bicycle, dog...)
    vision/spatial.ts   box centre -> left/ahead/right; box height -> near/close; 3 s de-duplication
    vision/binFinder.ts after /waste bin_color: HSV threshold for blue/green blob -> direction + beep rate
    i18n/phrases.ts     fixed phrases the app says itself (en/hi/pa)
```

**Suggested build order (each step demo-able):** shell + 2 halves + speech queue + api.ts → camera + obstacles + beeps → voice commands → Navigate actions → Read mode (guidance loop, /read, more, questions) → money commands → bin finder → share target + install + icons → Hindi/Punjabi → blindfold testing.

**Frontend must make sure:**
- Usable start to finish with eyes closed and TalkBack on.
- Obstacles work with no internet.
- Every backend `speech` is spoken; errors still speak something.
- Installs to the home screen; WhatsApp share works on the installed app (share target only works once installed).
- Test on Android Chrome (iPhone browsers don't vibrate).
- Never put API keys in the frontend; all AI goes through the backend.

## 8. Demo script (3 min, presenter blindfolded)

1. Open Saathi by voice, walk toward a chair: beeps speed up, step around it.
2. Hold up a bottle → "Plastic bottle. Dry waste. Blue bin." → follow beeps to the blue bucket → throw it in.
3. Read mode: scan a bill with a wrong total → overcharge caught.
4. Pay ₹500 for a ₹430 bill → "You should get 70 back" → get ₹50 → "20 rupees short."
5. "Check note" on a toy note → "may be fake, do not accept it."
6. Share a PDF from WhatsApp → ask "what's the due date?"
Close: "Four problem statements, one app, and the presenter never looked at the screen."

Props: blue + green buckets, bottle, banana peel, bills (one with a wrong total), a ₹500 + ₹50 note, a shop-bought toy note, a printed letter + PDF on WhatsApp, blindfold, Android phone, power bank, hotspot.

## 9. Still open (backend side)

- Deploy backend (Render free tier sleeps: open it ~1 min before the pitch) and frontend (Vercel); set `ALLOWED_ORIGINS`.
- Offline demo mode (canned answers for the demo props if venue Wi-Fi dies).
- Shared app key + rate limit so a public URL can't burn the AI quota.
- Optional: clearer fake reason "the portrait is not Mahatma Gandhi".

## 10. Other docs

- `README.md`: repo overview and run steps · `backend/README.md`: backend setup and endpoints
- `docs/README.md`: where pitch files, research, screenshots and diagrams go
