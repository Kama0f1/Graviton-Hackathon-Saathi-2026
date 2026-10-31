// All backend calls. Base URL from VITE_API_URL. Sends lang + session_id on every request.
// Response shapes = backend/app/schemas/models.py. On error it speaks the backend's `speech` and throws ApiError.
import { getLang, sessionId, type Lang } from './settings';
import { say } from './speech';
import { t } from '../i18n/phrases';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');

export type SpeechOnly = { speech: string };
export type SignResult = { speech: string; text: string; confident: boolean };
export type WasteResult = {
  speech: string; item: string;
  category: 'wet' | 'dry' | 'hazardous' | 'unknown';
  bin_color: 'green' | 'blue' | 'red' | null;
  confident: boolean;
};
export type GuidanceResult = {
  ready: boolean;
  move: 'left' | 'right' | 'up' | 'down' | 'closer' | 'back' | 'hold' | 'light' | 'none';
  speech: string;
};
export type BillItem = { name: string; qty: number | null; unit: string | null; amount: number };
export type Bill = {
  shop: string | null; currency: string; items: BillItem[];
  printed_total: number | null; computed_total: number | null; mismatch: boolean;
};
export type ReadResult = {
  kind: 'document' | 'bill'; speech: string; speech_more: string;
  doc_type: string | null; key_fields: Record<string, string>;
  bill: Bill | null; uncertain: string[];
};
export type MoneyMode = 'count' | 'change' | 'check';
export type MoneyResult = {
  mode: MoneyMode; speech: string; currency: string; total: number;
  items: { value: number; kind: 'note' | 'coin'; count: number }[];
  bill_total: number | null; paid: number | null;
  expected_change: number | null; difference: number | null;
  suspicious: { value: number; reason: 'not_rbi' | 'toy_text' | 'photocopy' | 'mismatch' | 'other' }[];
  unclear: boolean;
};

export class ApiError extends Error {
  constructor(public status: number, public speech: string) { super(speech); }
}

// Busy counter -> "thinking" status + waiting tick.
let busy = 0;
const busyListeners = new Set<(n: number) => void>();
export function onBusy(fn: (n: number) => void) { busyListeners.add(fn); return () => { busyListeners.delete(fn); }; }
const setBusy = (d: number) => { busy += d; busyListeners.forEach((f) => f(busy)); };

type Field = string | number | Blob | null | undefined;
type Opts = { timeoutMs?: number; quiet?: boolean; lang?: Lang };

async function post(path: string, fields: Record<string, Field>, opts: Opts = {}): Promise<Response> {
  const { timeoutMs = 25000, quiet = false } = opts;
  const fd = new FormData();
  fd.append('lang', opts.lang ?? getLang());
  fd.append('session_id', sessionId);
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue;
    if (v instanceof Blob) {
      const name = v instanceof File ? v.name : v.type === 'application/pdf' ? 'file.pdf' : 'photo.jpg';
      fd.append(k, v, name);
    } else fd.append(k, String(v));
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  if (!quiet) setBusy(1);
  try {
    let res: Response;
    try {
      res = await fetch(API_URL + path, { method: 'POST', body: fd, signal: ctrl.signal });
    } catch {
      throw new ApiError(0, ctrl.signal.aborted ? t('timeout') : t('offline'));
    }
    if (!res.ok) {
      let speech: string = t('error');
      try { const j = await res.json(); if (j?.speech) speech = j.speech; } catch { /* not json */ }
      throw new ApiError(res.status, speech);
    }
    return res;
  } catch (e) {
    if (!quiet && e instanceof ApiError) say(e.speech, 'answer');
    throw e;
  } finally {
    clearTimeout(timer);
    if (!quiet) setBusy(-1);
  }
}

const json = async <T,>(p: Promise<Response>) => (await p).json() as Promise<T>;

export const api = {
  health: async (): Promise<boolean> => {
    try {
      const r = await fetch(API_URL + '/health', { signal: AbortSignal.timeout(5000) });
      return r.ok;
    } catch { return false; }
  },
  describe: (image: Blob) => json<SpeechOnly>(post('/describe', { image })),
  sign: (image: Blob) => json<SignResult>(post('/sign', { image })),
  waste: (image: Blob) => json<WasteResult>(post('/waste', { image })),
  guidance: (image: Blob, target: 'document' | 'bill' = 'document') =>
    json<GuidanceResult>(post('/guidance', { image, target }, { quiet: true, timeoutMs: 8000 })),
  read: (file: Blob) => json<ReadResult>(post('/read', { file }, { timeoutMs: 40000 })),
  ask: (question: string) => json<SpeechOnly>(post('/read/ask', { question })),
  money: (image: Blob, mode: MoneyMode, extra: { paid?: number; bill_total?: number } = {}) =>
    json<MoneyResult>(post('/money', { image, mode, ...extra })),
  tts: async (text: string, lang: Lang) =>
    (await post('/tts', { text }, { quiet: true, lang, timeoutMs: 10000 })).blob(),
};
