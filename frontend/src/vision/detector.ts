// Obstacle alerts (built on Arush's COCO-SSD detection): runs on the phone, no internet needed after load.
// Close objects are spoken as ALERTS (they interrupt anything else); far ones as low-priority info.
import { useEffect, useRef, useState } from 'react'
import { say } from '../core/speech'
import { haptics } from '../core/haptics'
import { getLang, type Lang } from '../core/settings'
import { t } from '../i18n/phrases'

type Position = 'left' | 'centre' | 'right'

const POS: Record<Lang, Record<Position, string>> = {
  en: { left: 'on your left', centre: 'ahead', right: 'on your right' },
  hi: { left: 'आपकी बाईं ओर', centre: 'आपके सामने', right: 'आपकी दाईं ओर' },
  pa: { left: 'ਤੁਹਾਡੇ ਖੱਬੇ ਪਾਸੇ', centre: 'ਤੁਹਾਡੇ ਸਾਹਮਣੇ', right: 'ਤੁਹਾਡੇ ਸੱਜੇ ਪਾਸੇ' },
}
const CLOSE: Record<Lang, string> = { en: ', close', hi: ', बहुत पास', pa: ', ਬਹੁਤ ਨੇੜੇ' }
const NAMES: Record<Lang, Record<string, string>> = {
  en: {},
  hi: { person: 'व्यक्ति', chair: 'कुर्सी', bottle: 'बोतल', car: 'कार', bicycle: 'साइकिल', dog: 'कुत्ता', bench: 'बेंच',
        table: 'मेज़', 'dining table': 'मेज़', couch: 'सोफ़ा', bed: 'बिस्तर', motorcycle: 'मोटरसाइकिल', bus: 'बस', truck: 'ट्रक',
        cat: 'बिल्ली', 'potted plant': 'गमला', tv: 'टीवी', laptop: 'लैपटॉप', 'cell phone': 'फ़ोन', suitcase: 'सूटकेस' },
  pa: { person: 'ਵਿਅਕਤੀ', chair: 'ਕੁਰਸੀ', bottle: 'ਬੋਤਲ', car: 'ਕਾਰ', bicycle: 'ਸਾਈਕਲ', dog: 'ਕੁੱਤਾ', bench: 'ਬੈਂਚ',
        table: 'ਮੇਜ਼', 'dining table': 'ਮੇਜ਼', couch: 'ਸੋਫ਼ਾ', bed: 'ਬਿਸਤਰਾ', motorcycle: 'ਮੋਟਰਸਾਈਕਲ', bus: 'ਬੱਸ', truck: 'ਟਰੱਕ',
        cat: 'ਬਿੱਲੀ', 'potted plant': 'ਗਮਲਾ', tv: 'ਟੀਵੀ', laptop: 'ਲੈਪਟਾਪ', 'cell phone': 'ਫ਼ੋਨ', suitcase: 'ਸੂਟਕੇਸ' },
}

export type Seen = { name: string; pos: Position; close: boolean } | null

export function useObstacles(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  enabled: boolean,
  mirrored: boolean,
) {
  const [status, setStatus] = useState('')
  const [count, setCount] = useState(0)
  const [seen, setSeen] = useState<Seen>(null)   // the biggest (= nearest) object right now, for the on-screen badge
  const mirroredRef = useRef(mirrored)
  mirroredRef.current = mirrored
  const lastSaid = useRef(new Map<string, number>())
  const lastAny = useRef(0)
  const lastBuzz = useRef(0)

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
        const preds = (await detectObjects(video)).filter((p) => p.score >= 0.5)
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
        for (const p of preds) {
          const [bx, y, w, h] = p.bbox
          // on a front/laptop camera the preview is mirrored: flip x so left/right match what the user sees
          const x = mirroredRef.current ? W - bx - w : bx
          const cx = (x + w / 2) / W
          const pos: Position = cx < 0.38 ? 'left' : cx > 0.62 ? 'right' : 'centre'
          const area = (w * h) / (W * H)
          const close = area >= 0.15
          if (!biggest || area > biggest.area) biggest = { area, seen: { name: NAMES[lang][p.class] ?? p.class, pos, close } }
          if (ctx) {
            ctx.strokeStyle = close ? '#ff6b5e' : '#2fd3b0'
            ctx.lineWidth = 6
            ctx.strokeRect(x, y, w, h)
            ctx.font = 'bold 30px system-ui, sans-serif'
            const label = `${NAMES[lang][p.class] ?? p.class} · ${t(pos)}`
            ctx.fillStyle = close ? '#b3261e' : '#0f6f5c'
            ctx.fillRect(x, Math.max(0, y - 42), ctx.measureText(label).width + 20, 42)
            ctx.fillStyle = '#fff'
            ctx.fillText(label, x + 10, Math.max(32, y - 11))
          }
          if (p.score < 0.62) continue
          // speech: same object+side at most every 6 s; anything at most every 2.5 s (close ones: 1.5 s)
          const key = `${p.class}-${pos}`
          if (now - (lastSaid.current.get(key) ?? 0) < 6000) continue
          if (now - lastAny.current < (close ? 1500 : 2500)) continue
          lastSaid.current.set(key, now)
          lastAny.current = now
          const name = NAMES[lang][p.class] ?? p.class
          const text = `${name} ${POS[lang][pos]}${close ? CLOSE[lang] : ''}.`
          say(lang === 'en' ? text.charAt(0).toUpperCase() + text.slice(1) : text, close ? 'alert' : 'info')
          if (now - lastBuzz.current > 1500 && area >= 0.15) {
            lastBuzz.current = now
            if (area >= 0.35) haptics.veryNear(); else haptics.near()
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
