// Obstacle alerts (built on Arush's COCO-SSD detection): runs on the phone, no internet needed after load.
// Close objects are spoken as ALERTS (they interrupt anything else); far ones as low-priority info.
import { useEffect, useRef, useState } from 'react'
import { say, speakingNow } from '../core/speech'
import { isBusy } from '../core/api'
import { beep } from '../core/audio'
import { haptics } from '../core/haptics'
import { canVibrate, getLang, getVibrate, type Lang } from '../core/settings'
import { t } from '../i18n/phrases'

type Position = 'left' | 'centre' | 'right'

const POS: Record<Lang, Record<Position, string>> = {
  en: { left: 'on your left', centre: 'ahead', right: 'on your right' },
  hi: { left: 'आपकी बाईं ओर', centre: 'आपके सामने', right: 'आपकी दाईं ओर' },
  pa: { left: 'ਤੁਹਾਡੇ ਖੱਬੇ ਪਾਸੇ', centre: 'ਤੁਹਾਡੇ ਸਾਹਮਣੇ', right: 'ਤੁਹਾਡੇ ਸੱਜੇ ਪਾਸੇ' },
}
const CLOSE: Record<Lang, string> = { en: ', close', hi: ', बहुत पास', pa: ', ਬਹੁਤ ਨੇੜੇ' }
// "2 metres" / "2 मीटर पर" / "2 ਮੀਟਰ 'ਤੇ"
const METRES: Record<Lang, (m: number) => string> = {
  en: (m) => (m < 1 ? 'less than 1 metre' : m === 1 ? '1 metre' : `${m} metres`),
  hi: (m) => (m < 1 ? '1 मीटर से कम दूरी पर' : `${m} मीटर पर`),
  pa: (m) => (m < 1 ? "1 ਮੀਟਰ ਤੋਂ ਘੱਟ ਦੂਰੀ 'ਤੇ" : `${m} ਮੀਟਰ 'ਤੇ`),
}
export const sayMetres = (m: number, lang: Lang) => METRES[lang](m)

// Typical real heights (m) of COCO objects. Distance ≈ real height × focal length ÷ height in pixels.
const HEIGHT: Record<string, number> = {
  person: 1.65, bicycle: 1.0, car: 1.5, motorcycle: 1.1, bus: 3.0, truck: 3.0, train: 3.5, 'traffic light': 0.9,
  'fire hydrant': 0.8, 'stop sign': 0.75, 'parking meter': 1.3, bench: 0.85, cat: 0.3, dog: 0.55, horse: 1.6, cow: 1.4,
  sheep: 0.8, elephant: 2.8, backpack: 0.5, umbrella: 1.0, handbag: 0.35, suitcase: 0.65, chair: 0.9, couch: 0.85,
  'potted plant': 0.6, bed: 0.6, 'dining table': 0.75, toilet: 0.75, tv: 0.6, laptop: 0.25, refrigerator: 1.75,
  oven: 0.9, microwave: 0.3, sink: 0.3, bottle: 0.25, 'cell phone': 0.15, book: 0.25, clock: 0.3, vase: 0.3,
}
// typical widths (m), used when the object is too tall to fit in the picture (= it is close)
const WIDTH: Record<string, number> = { person: 0.45, chair: 0.5, 'dining table': 1.2, couch: 1.8, car: 1.8, bench: 1.4, dog: 0.3, refrigerator: 0.7, tv: 1.0 }
const FOV_LONG_SIDE = 66 // degrees: typical phone main camera across the long side of the picture
/** Rough distance in metres, rounded (0.5 m steps up to 2 m, then whole metres). null = unknown object. */
export function estimateMetres(cls: string, bbox: number[], W: number, H: number): number | null {
  const real = HEIGHT[cls]
  if (!real) return null
  const [x, y, w, h] = bbox
  const focal = Math.max(W, H) / 2 / Math.tan((FOV_LONG_SIDE / 2) * Math.PI / 180)
  let m = (real * focal) / Math.max(1, h)
  // cut off by the top/bottom edge = it is bigger than we see = closer than the height says
  const cutV = y <= H * 0.02 || y + h >= H * 0.98
  const cutH = x <= W * 0.02 || x + w >= W * 0.98
  if (cutV) {
    if (WIDTH[cls] && !cutH) m = Math.min(m, (WIDTH[cls] * focal) / Math.max(1, w)) // use the width instead
    const area = (w * h) / (W * H)
    m = Math.min(m, area >= 0.45 ? 0.8 : area >= 0.25 ? 1.5 : m)
  }
  m = Math.max(0.5, Math.min(20, m))
  return m < 2 ? Math.round(m * 2) / 2 : Math.round(m)
}
const NAMES: Record<Lang, Record<string, string>> = {
  en: {},
  hi: { person: 'व्यक्ति', chair: 'कुर्सी', bottle: 'बोतल', car: 'कार', bicycle: 'साइकिल', dog: 'कुत्ता', bench: 'बेंच',
        table: 'मेज़', 'dining table': 'मेज़', couch: 'सोफ़ा', bed: 'बिस्तर', motorcycle: 'मोटरसाइकिल', bus: 'बस', truck: 'ट्रक',
        cat: 'बिल्ली', 'potted plant': 'गमला', tv: 'टीवी', laptop: 'लैपटॉप', 'cell phone': 'फ़ोन', suitcase: 'सूटकेस' },
  pa: { person: 'ਵਿਅਕਤੀ', chair: 'ਕੁਰਸੀ', bottle: 'ਬੋਤਲ', car: 'ਕਾਰ', bicycle: 'ਸਾਈਕਲ', dog: 'ਕੁੱਤਾ', bench: 'ਬੈਂਚ',
        table: 'ਮੇਜ਼', 'dining table': 'ਮੇਜ਼', couch: 'ਸੋਫ਼ਾ', bed: 'ਬਿਸਤਰਾ', motorcycle: 'ਮੋਟਰਸਾਈਕਲ', bus: 'ਬੱਸ', truck: 'ਟਰੱਕ',
        cat: 'ਬਿੱਲੀ', 'potted plant': 'ਗਮਲਾ', tv: 'ਟੀਵੀ', laptop: 'ਲੈਪਟਾਪ', 'cell phone': 'ਫ਼ੋਨ', suitcase: 'ਸੂਟਕੇਸ' },
}

// Not things you walk into, and the usual false alarms (a poster or notice board read as a TV or fridge): ignored.
const IGNORE = new Set([
  'tv', 'laptop', 'clock', 'book', 'cell phone', 'remote', 'mouse', 'keyboard', 'kite', 'frisbee', 'sports ball',
  'toothbrush', 'hair drier', 'scissors', 'teddy bear', 'microwave', 'toaster', 'oven', 'tie', 'baseball glove',
  'baseball bat', 'tennis racket', 'skis', 'snowboard', 'surfboard', 'skateboard', 'wine glass', 'cup', 'fork', 'knife',
  'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake',
])
// big flat-looking classes need a sure answer, and a fridge must stand on the floor (its bottom low in the picture)
const MIN_SCORE: Record<string, number> = { refrigerator: 0.75, bed: 0.6, couch: 0.55, 'dining table': 0.5, 'stop sign': 0.6, 'traffic light': 0.55 }
type Pred = { class: string; score: number; bbox: number[] }
export function keepPrediction(p: Pred, H: number): boolean {
  if (IGNORE.has(p.class)) return false
  if (p.score < (MIN_SCORE[p.class] ?? 0)) return false
  if (p.class === 'refrigerator') {
    const [, y, , h] = p.bbox
    if (y + h < H * 0.8) return false // floats on the wall: a poster, cupboard or notice board, not a fridge
  }
  return true
}

const PEOPLE: Record<Lang, string> = { en: 'people', hi: 'लोग', pa: 'ਲੋਕ' }

export type Seen = { name: string; pos: Position; close: boolean; metres: number | null } | null

export function useObstacles(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
  mirrored: boolean,
  onlyClose = false,   // while walking directions: speak only things that are about to be in the way
) {
  const [status, setStatus] = useState('')
  const [count, setCount] = useState(0)
  const [seen, setSeen] = useState<Seen>(null)   // the biggest (= nearest) object right now, for the on-screen badge
  const mirroredRef = useRef(mirrored)
  mirroredRef.current = mirrored
  const lastSaid = useRef(new Map<string, { at: number; metres: number | null }>())
  const lastAny = useRef(0)
  const lastBuzz = useRef(0)
  const history = useRef<Set<string>[]>([])  // what was seen in the last 3 frames (one-frame flickers are ignored)
  const onlyCloseRef = useRef(onlyClose)
  onlyCloseRef.current = onlyClose

  useEffect(() => {
    const canvas = canvasRef.current
    if (!enabled) {
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      setCount(0)
      setSeen(null)
      return
    }
    let active = true
    let timer: number | undefined

    const run = async () => {
      const video = videoRef.current
      const c = canvasRef.current
      if (!active || !video || !c) return
      if (video.readyState < 2 || !video.videoWidth) { timer = window.setTimeout(run, 300); return }
      try {
        const preds = (await detectObjects(video)).filter((p) => keepPrediction(p, video.videoHeight))
        if (!active) return
        const ctx = c.getContext('2d')
        c.width = video.videoWidth
        c.height = video.videoHeight
        ctx?.clearRect(0, 0, c.width, c.height)
        setCount(preds.length)
        const now = Date.now()
        const lang = getLang()
        const W = video.videoWidth, H = video.videoHeight
        if (ctx) {
          // zone guides: left | ahead | right
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'
          ctx.lineWidth = 3
          ctx.setLineDash([14, 12])
          for (const f of [0.38, 0.62]) { ctx.beginPath(); ctx.moveTo(W * f, 0); ctx.lineTo(W * f, H); ctx.stroke() }
          ctx.setLineDash([])
        }
        let biggest: { area: number; seen: NonNullable<Seen> } | null = null
        let best: { key: string; cls: string; pos: Position; close: boolean; area: number; importance: number; metres: number | null } | null = null
        const frameKeys = new Set<string>()
        for (const p of preds) {
          const [bx, y, w, h] = p.bbox
          // on a front/laptop camera the preview is mirrored: flip x so left/right match what the user sees
          const x = mirroredRef.current ? W - bx - w : bx
          const cx = (x + w / 2) / W
          const pos: Position = cx < 0.38 ? 'left' : cx > 0.62 ? 'right' : 'centre'
          const area = (w * h) / (W * H)
          const metres = estimateMetres(p.class, p.bbox, W, H)
          const close = metres != null ? metres <= 1.5 : area >= 0.12
          if (!biggest || area > biggest.area) biggest = { area, seen: { name: NAMES[lang][p.class] ?? p.class, pos, close, metres } }
          if (ctx) {
            ctx.strokeStyle = close ? '#ff3b3b' : '#ffd400'
            ctx.lineWidth = 6
            ctx.strokeRect(x, y, w, h)
            ctx.font = 'bold 30px system-ui, sans-serif'
            const label = `${NAMES[lang][p.class] ?? p.class} · ${t(pos)}${metres != null ? ` · ${metres} m` : ''}`
            ctx.fillStyle = close ? '#c4000f' : '#ffd400'
            ctx.fillRect(x, Math.max(0, y - 42), ctx.measureText(label).width + 20, 42)
            ctx.fillStyle = close ? '#fff' : '#000'
            ctx.fillText(label, x + 10, Math.max(32, y - 11))
          }
          if (p.score >= 0.45) frameKeys.add(`${p.class}-${pos}`)
          // only things that matter for walking are spoken: anything close, or something fairly near straight ahead
          const importance = close ? 2 : pos === 'centre' && area >= 0.06 && !onlyCloseRef.current ? 1 : 0
          if (p.score < (close ? 0.45 : 0.6) || !importance) continue
          if (!best || importance > best.importance || (importance === best.importance && area > best.area)) {
            best = { key: `${p.class}-${pos}`, cls: p.class, pos, close, area, importance, metres }
          }
        }
        history.current = [...history.current.slice(-2), frameKeys]
        if (best && history.current.filter((k) => k.has(best!.key)).length >= 2) {
          const b = best
          const prev = lastSaid.current.get(b.key)
          const anyAgo = now - lastAny.current
          // the same thing again only if it came at least 1 m closer (or 15 s passed): no repeating a standing person
          const news = !prev || now - prev.at > 15000 || (b.metres != null && prev.metres != null && b.metres <= prev.metres - 1)
          if (news && now - (prev?.at ?? 0) > 2500 && anyAgo > (b.close ? 2500 : 5000)) {
            lastSaid.current.set(b.key, { at: now, metres: b.metres })
            lastAny.current = now
            if (speakingNow() === 'answer' || isBusy()) {
              // never talk over an answer: a close thing gets a warning beep instead of words
              if (b.close) beep(440, 160, 0.3)
            } else {
              const n = preds.filter((q) => q.class === b.cls && q.score >= 0.55).length
              const name = b.cls === 'person' && n > 1 ? `${n} ${PEOPLE[lang]}` : NAMES[lang][b.cls] ?? b.cls
              // say how far when we can estimate it, otherwise just "close"
              const how = b.metres != null ? `, ${sayMetres(b.metres, lang)}` : b.close ? CLOSE[lang] : ''
              const text = `${name} ${POS[lang][b.pos]}${how}${lang === 'en' ? '.' : '।'}`
              say(lang === 'en' ? text.charAt(0).toUpperCase() + text.slice(1) : text, b.close ? 'alert' : 'info')
            }
          }
        }
        // ---- proximity feel (separate from speech, every frame): the closer, the faster and stronger ----
        // nearest thing = biggest box in the middle 70% of the view (things at the very edge are not in the way)
        let level = 0
        for (const p of preds) {
          const [bx, , w, h] = p.bbox
          const cx = (bx + w / 2) / W
          if (cx < 0.15 || cx > 0.85) continue
          const area = (w * h) / (W * H)
          const m = estimateMetres(p.class, p.bbox, W, H)
          const byArea = area >= 0.45 ? 3 : area >= 0.25 ? 2 : area >= 0.12 ? 1 : 0
          const byMetres = m == null ? 0 : m <= 1 ? 3 : m <= 1.8 ? 2 : m <= 3 ? 1 : 0
          level = Math.max(level, byArea, byMetres)
        }
        const every = [0, 1500, 900, 550][level]
        if (level && now - lastBuzz.current > every) {
          lastBuzz.current = now
          if (canVibrate() && getVibrate()) {
            if (level === 3) haptics.veryNear(); else if (level === 2) haptics.near(); else haptics.nearSoft()
          } else {
            beep(500 + level * 250, 70, 0.25) // iPhone / vibration off: a parking-sensor beep instead
          }
        }
        setSeen(biggest?.seen ?? null)
        setStatus('')
      } catch (e) {
        console.error('Detection error', e)
      }
      if (active) timer = window.setTimeout(run, 400)
    }

    setStatus(t('modelLoading'))
    // TF.js is ~1 MB: load it only when Navigate mode is opened, so the app starts fast
    let detectObjects: typeof import('./objectDetection').detectObjects
    import('./objectDetection')
      .then(async (m) => { detectObjects = m.detectObjects; await m.loadDetectionModel() })
      .then(() => { if (active) { setStatus(''); void run() } })
      .catch((e) => { console.error(e); if (active) setStatus(t('modelFailed')) })

    return () => { active = false; if (timer !== undefined) clearTimeout(timer) }
  }, [enabled, videoRef, canvasRef])

  return { status, count, seen }
}
