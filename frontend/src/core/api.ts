// All backend calls. In development the Vite dev server proxies /api to the FastAPI backend
// (see vite.config.ts), so the phone only needs ONE https tunnel. Set VITE_API_URL to use another server.
// Response shapes = backend/app/schemas/models.py. On error it speaks the backend's `speech` and throws ApiError.
import { getLang, sessionId, type Lang } from './settings'
import { say } from './speech'
import { t } from '../i18n/phrases'

export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '')

export type SpeechOnly = { speech: string }
export type SignResult = { speech: string; text: string; confident: boolean }
export type WasteResult = {
  speech: string; item: string
  category: 'wet' | 'dry' | 'hazardous' | 'unknown'
  bin_color: 'green' | 'blue' | 'red' | null
  confident: boolean
}
export type GuidanceResult = {
  ready: boolean
  move: 'left' | 'right' | 'up' | 'down' | 'closer' | 'back' | 'hold' | 'light' | 'none'
  speech: string
}
export type BillItem = { name: string; qty: number | null; unit: string | null; amount: number }
export type Bill = {
  shop: string | null; currency: string; items: BillItem[]
  printed_total: number | null; computed_total: number | null; mismatch: boolean
}
export type ReadResult = {
  kind: 'document' | 'bill'; speech: string; speech_more: string; full_text?: string
  doc_type: string | null; key_fields: Record<string, string>
  bill: Bill | null; uncertain: string[]
}
export type BinSpot = { found: boolean; position: 'left' | 'ahead' | 'right'; metres: number; color: string; speech: string }
export type HazardResult = { hazard: string; position: 'left' | 'ahead' | 'right'; metres: number; urgent: boolean; speech: string }
export type MoneyMode = 'count' | 'change' | 'check'
export type MoneyResult = {
  mode: MoneyMode; speech: string; currency: string; total: number
  items: { value: number; kind: 'note' | 'coin'; count: number }[]
  bill_total: number | null; paid: number | null
  expected_change: number | null; difference: number | null
  suspicious: { value: number; reason: 'not_rbi' | 'toy_text' | 'photocopy' | 'mismatch' | 'other' }[]
  unclear: boolean
  maybe?: number[]                                   // unsure between these values, e.g. [10, 20]
  checks?: ('rbi_text' | 'gandhi' | 'thread')[]      // note check: features that looked right
}

export class ApiError extends Error {
  status: number
  speech: string
  constructor(status: number, speech: string) {
    super(speech)
    this.status = status
    this.speech = speech
  }
}

// Busy counter -> "Thinking" chip + waiting tick.
let busy = 0
const busyListeners = new Set<(n: number) => void>()
export function onBusy(fn: (n: number) => void) {
  busyListeners.add(fn)
  return () => { busyListeners.delete(fn) }
}
const setBusy = (d: number) => { busy = Math.max(0, busy + d); busyListeners.forEach((f) => f(busy)) }
export const isBusy = () => busy > 0

type Field = string | number | Blob | null | undefined
type Opts = { timeoutMs?: number; quiet?: boolean; lang?: Lang }

/** When the server last answered anything. The health check skips itself while real requests are getting answers. */
export let lastReply = 0

async function post(path: string, fields: Record<string, Field>, opts: Opts = {}): Promise<Response> {
  const { timeoutMs = 30000, quiet = false } = opts
  const fd = new FormData()
  fd.append('lang', opts.lang ?? getLang())
  fd.append('session_id', sessionId)
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) continue
    if (v instanceof Blob) {
      const name = v instanceof File ? v.name : v.type === 'application/pdf' ? 'file.pdf' : 'photo.jpg'
      fd.append(k, v, name)
    } else fd.append(k, String(v))
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  if (!quiet) setBusy(1)
  try {
    let res: Response
    try {
      res = await fetch(API_URL + path, { method: 'POST', body: fd, signal: ctrl.signal })
      lastReply = Date.now() // any answer at all (even an error) means the server is reachable
    } catch {
      throw new ApiError(0, ctrl.signal.aborted ? t('timeout') : t('offline'))
    }
    if (!res.ok) {
      let speech: string = res.status === 413 ? t('tooBig') : t('error')
      try { const j = await res.json(); if (j?.speech) speech = j.speech } catch { /* not json */ }
      throw new ApiError(res.status, speech)
    }
    return res
  } catch (e) {
    if (!quiet && e instanceof ApiError) say(e.speech, 'answer')
    throw e
  } finally {
    clearTimeout(timer)
    if (!quiet) setBusy(-1)
  }
}

const json = async <T,>(p: Promise<Response>) => (await p).json() as Promise<T>

export const api = {
  health: async (): Promise<boolean> => {
    try {
      // 12 s: a server that has been asleep (free hosting) can take several seconds to wake up
      const r = await fetch(API_URL + '/health', { signal: AbortSignal.timeout(12000), cache: 'no-store' })
      if (r.ok) lastReply = Date.now()
      return r.ok
    } catch { return false }
  },
  describe: (image: Blob) => json<SpeechOnly>(post('/describe', { image })),
  sign: (image: Blob) => json<SignResult>(post('/sign', { image })),
  waste: (image: Blob) => json<WasteResult>(post('/waste', { image })),
  guidance: (image: Blob, target: 'document' | 'bill' = 'document') =>
    json<GuidanceResult>(post('/guidance', { image, target }, { quiet: true, timeoutMs: 9000 })),
  // walking hazard check: quiet (no 'thinking' tick, no spoken errors), short timeout: the next frame is coming anyway
  findBin: (image: Blob, color?: string | null) =>
    json<BinSpot>(post('/findbin', { image, color: color ?? '' }, { quiet: true, timeoutMs: 8000 })),
  hazard: (image: Blob) => json<HazardResult>(post('/hazard', { image }, { quiet: true, timeoutMs: 7000 })),
  read: (file: Blob) => json<ReadResult>(post('/read', { file }, { timeoutMs: 45000 })),
  // `context` = the document the app read last, so questions work even if the server forgot it (serverless)
  ask: (question: string, context?: string) => json<SpeechOnly>(post('/read/ask', { question, context })),
  money: (image: Blob, mode: MoneyMode, extra: { paid?: number; bill_total?: number } = {}) =>
    json<MoneyResult>(post('/money', { image, mode, ...extra })),
  tts: async (text: string, lang: Lang) =>
    (await post('/tts', { text }, { quiet: true, lang, timeoutMs: 10000 })).blob(),
}
