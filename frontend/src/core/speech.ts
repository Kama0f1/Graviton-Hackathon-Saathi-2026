// TTS queue with priority: alert (obstacle / fake note) > answer > info.
// A higher priority cuts off whatever is speaking; an interrupted answer RESUMES afterwards from the
// sentence it was on (alerts must never make the user lose an answer). stop() clears; repeat() replays.
// en -> phone voice (fast, offline). hi/pa -> backend /tts (Sarvam), phone voice as fallback.
import { api } from './api';
import { getLang, type Lang } from './settings';

export type Priority = 'info' | 'answer' | 'alert';
const RANK: Record<Priority, number> = { info: 0, answer: 1, alert: 2 };

type Line = {
  text: string; priority: Priority; lang: Lang;
  from?: number;   // phone voice: sentence chunk to start at (resume)
  offset?: number; // Sarvam audio: seconds to start at (resume)
  at?: number;     // phone voice: chunk being spoken right now
};
export type Caption = { text: string; priority: Priority; speaking: boolean };

let queue: Line[] = [];
let current: Line | null = null;
let shown: Line | null = null;   // stays on the caption bar after speaking ends
let last: Line | null = null;    // for "repeat"
let gen = 0;                     // bumps on cancel so stale end-events are ignored
let blocked: Line | null = null; // browser refused audio before the first tap

const listeners = new Set<(c: Caption) => void>();
export function onCaption(fn: (c: Caption) => void) {
  listeners.add(fn);
  emit();
  return () => { listeners.delete(fn); };
}
function emit() {
  const l = current ?? shown;
  // once an alert has finished, keep its text but drop the red alert styling
  const priority: Priority = current ? current.priority : shown?.priority === 'alert' ? 'info' : shown?.priority ?? 'info';
  const c: Caption = { text: l?.text ?? '', priority, speaking: !!current };
  listeners.forEach((f) => f(c));
}

export function say(text: string, priority: Priority = 'answer', lang: Lang = getLang()) {
  text = text.trim();
  if (!text) return;
  const line: Line = { text, priority, lang };
  if (priority !== 'info') last = line;
  const r = RANK[priority];
  if (priority === 'alert') queue = queue.filter((l) => l.priority !== 'alert'); // only the newest alert matters
  if (current && r > RANK[current.priority]) {
    const cut = current;
    // resume the interrupted answer right after this line (info chatter is not worth resuming)
    const resume: Line[] = cut.priority === 'answer'
      ? [{ ...cut, at: undefined, from: cut.at ?? 0,
           offset: cut.lang !== 'en' && !audio.paused ? Math.max(0, audio.currentTime - 1) : cut.offset }]
      : [];
    queue = [line, ...resume, ...queue.filter((l) => l.priority !== 'info')]; // keep waiting answers
    cancelCurrent();
    return;
  }
  const i = queue.findIndex((l) => RANK[l.priority] < r);
  if (i < 0) queue.push(line); else queue.splice(i, 0, line);
  if (!current) next();
}

export function stop() {
  queue = [];
  cancelCurrent();
}

export function repeat() {
  if (last) say(last.text, last.priority, last.lang);
}

function next() {
  current = queue.shift() ?? null;
  if (current) shown = current;
  emit();
  if (!current) return;
  const my = ++gen;
  speakLine(current, my).finally(() => {
    if (my !== gen) return;
    current = null;
    next();
  });
}

function cancelCurrent() {
  gen++;
  try { speechSynthesis.cancel(); } catch { /* none */ }
  audio.pause();
  current = null;
  next();
}

// ---------- engines ----------
const audio = new Audio();
const ttsCache = new Map<string, string>(); // "lang|text" -> object URL

async function speakLine(line: Line, my: number) {
  if (line.lang !== 'en') {
    try {
      const key = `${line.lang}|${line.text}`;
      let url = ttsCache.get(key);
      if (!url) {
        url = URL.createObjectURL(await api.tts(line.text, line.lang));
        ttsCache.set(key, url);
      }
      if (my !== gen) return;
      await playAudio(url, line, line.offset);
      return;
    } catch {
      if (my !== gen) return; // cancelled while fetching
    }
  }
  await webSpeech(line, my);
}

function playAudio(url: string, line: Line, offset?: number) {
  return new Promise<void>((resolve, reject) => {
    audio.src = url;
    if (offset) audio.addEventListener('loadedmetadata', () => { audio.currentTime = offset; }, { once: true });
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('audio'));
    audio.onpause = () => resolve();
    audio.play().catch((e) => {
      if (e?.name === 'NotAllowedError') { blocked = line; resolve(); } else reject(e);
    });
  });
}

const VOICE_LANG: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' };

function pickVoice(lang: Lang) {
  const voices = speechSynthesis.getVoices();
  const want = VOICE_LANG[lang].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === want) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(want.slice(0, 2)))
  );
}

// One utterance per sentence: Chrome stops long utterances (~15 s), and an interrupted
// answer can resume from the exact sentence it was on.
function chunks(text: string): string[] {
  const parts = (text.match(/[^.!?।\n]+[.!?।]?/g) ?? [text]).map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}

async function webSpeech(line: Line, my: number) {
  if (!('speechSynthesis' in window)) return;
  const voice = pickVoice(line.lang);
  const parts = chunks(line.text);
  for (let i = line.from ?? 0; i < parts.length; i++) {
    const part = parts[i];
    if (my !== gen) return;
    line.at = i;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(part);
      u.lang = VOICE_LANG[line.lang];
      if (voice) u.voice = voice;
      u.rate = 1.05;
      const done = () => { clearTimeout(guard); resolve(); };
      const guard = setTimeout(done, 2500 + part.length * 110); // onend sometimes never fires
      u.onend = done;
      u.onerror = (e) => {
        if (e.error === 'not-allowed') blocked = line;
        done();
      };
      (window as unknown as { _u?: SpeechSynthesisUtterance })._u = u; // keep a ref (Chrome GC bug)
      speechSynthesis.speak(u);
    });
    if (blocked === line) return;
  }
}

// Browsers block audio until the first touch: replay whatever was refused.
function unlock() {
  if (!blocked) return;
  const l = blocked;
  blocked = null;
  say(l.text, l.priority, l.lang);
}
window.addEventListener('pointerdown', unlock, true);
window.addEventListener('keydown', unlock, true);
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
