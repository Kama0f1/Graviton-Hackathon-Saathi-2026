// App-wide settings: language (remembered on this phone) and the session id sent with every request.
export type Lang = 'en' | 'hi' | 'pa'
export const LOCALE: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', pa: 'pa-IN' }

function load(): Lang {
  try {
    const v = localStorage.getItem('saathi.lang')
    if (v === 'en' || v === 'hi' || v === 'pa') return v
  } catch { /* storage blocked */ }
  return 'en'
}

let lang: Lang = load()
const listeners = new Set<(l: Lang) => void>()
export const getLang = () => lang
export function setLang(l: Lang) {
  lang = l
  try { localStorage.setItem('saathi.lang', l) } catch { /* ignore */ }
  listeners.forEach((f) => f(l))
}
export function onLang(fn: (l: Lang) => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// Vibration on/off (some users find it annoying; iPhone browsers can't vibrate at all).
let vibrate = (() => { try { return localStorage.getItem('saathi.vibrate') !== 'off' } catch { return true } })()
export const getVibrate = () => vibrate
export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator
export function setVibrate(on: boolean) {
  vibrate = on
  try { localStorage.setItem('saathi.vibrate', on ? 'on' : 'off') } catch { /* ignore */ }
}

// One id per app start: the backend uses it to remember the last document/bill and the amount paid.
export const sessionId: string =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
