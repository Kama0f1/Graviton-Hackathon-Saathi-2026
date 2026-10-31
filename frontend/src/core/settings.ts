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
  changed()
}

// Alerts and voice speed (remembered on this phone). Anything that shows them subscribes with onSettings.
export type Speed = 'slow' | 'normal' | 'fast'
export const SPEED_RATE: Record<Speed, number> = { slow: 0.85, normal: 1, fast: 1.2 }
const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }
let obstacles = read('saathi.obstacles', 'on') !== 'off'
let hazards = read('saathi.hazards', 'on') !== 'off'
let speed: Speed = (['slow', 'normal', 'fast'] as const).find((x) => x === read('saathi.speed', 'normal')) ?? 'normal'
const settingListeners = new Set<() => void>()
const changed = () => settingListeners.forEach((f) => f())
export const getObstacles = () => obstacles
export const getHazards = () => hazards
export const getSpeed = () => speed
export function setObstacles(on: boolean) { obstacles = on; write('saathi.obstacles', on ? 'on' : 'off'); changed() }
export function setHazards(on: boolean) { hazards = on; write('saathi.hazards', on ? 'on' : 'off'); changed() }
export function setSpeed(s: Speed) { speed = s; write('saathi.speed', s); changed() }
export function onSettings(fn: () => void) {
  settingListeners.add(fn)
  return () => { settingListeners.delete(fn) }
}

// One id per app start: the backend uses it to remember the last document/bill and the amount paid.
export const sessionId: string =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
