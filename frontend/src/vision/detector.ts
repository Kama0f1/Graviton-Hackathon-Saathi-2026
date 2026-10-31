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
const NAMES: Record<Lang, Record<string, string>> = {
  en: {},
  hi: { person: 'व्यक्ति', chair: 'कुर्सी', bottle: 'बोतल', car: 'कार', bicycle: 'साइकिल', dog: 'कुत्ता', bench: 'बेंच',
        table: 'मेज़', 'dining table': 'मेज़', couch: 'सोफ़ा', bed: 'बिस्तर', motorcycle: 'मोटरसाइकिल', bus: 'बस', truck: 'ट्रक',
        cat: 'बिल्ली', 'potted plant': 'गमला', tv: 'टीवी', laptop: 'लैपटॉप', 'cell phone': 'फ़ोन', suitcase: 'सूटकेस' },
  pa: { person: 'ਵਿਅਕਤੀ', chair: 'ਕੁਰਸੀ', bottle: 'ਬੋਤਲ', car: 'ਕਾਰ', bicycle: 'ਸਾਈਕਲ', dog: 'ਕੁੱਤਾ', bench: 'ਬੈਂਚ',
        table: 'ਮੇਜ਼', 'dining table': 'ਮੇਜ਼', couch: 'ਸੋਫ਼ਾ', bed: 'ਬਿਸਤਰਾ', motorcycle: 'ਮੋਟਰਸਾਈਕਲ', bus: 'ਬੱਸ', truck: 'ਟਰੱਕ',
        cat: 'ਬਿੱਲੀ', 'potted plant': 'ਗਮਲਾ', tv: 'ਟੀਵੀ', laptop: 'ਲੈਪਟਾਪ', 'cell phone': 'ਫ਼ੋਨ', suitcase: 'ਸੂਟਕੇਸ' },
}

const PEOPLE: Record<Lang, string> = { en: 'people', hi: 'लोग', pa: 'ਲੋਕ' }

export type Seen = { name: string; pos: Position; close: boolean } | null

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
  const lastSaid = useRef(new Map<string, number>())
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
        const preds = await detectObjects(video)
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
        let best: { key: string; cls: string; pos: Position; close: boolean; area: number; importance: number } | null = null
        const frameKeys = new Set<string>()
        for (const p of preds) {
          const [bx, y, w, h] = p.bbox
          // on a front/laptop camera the preview is mirrored: flip x so left/right match what the user sees
          const x = mirroredRef.current ? W - bx - w : bx
          const cx = (x + w / 2) / W
          const pos: Position = cx < 0.38 ? 'left' : cx > 0.62 ? 'right' : 'centre'
          const area = (w * h) / (W * H)
          const close = area >= 0.12
          if (!biggest || area > biggest.area) biggest = { area, seen: { name: NAMES[lang][p.class] ?? p.class, pos, close } }
          if (ctx) {
            ctx.strokeStyle = close ? '#ff3b3b' : '#ffd400'
            ctx.lineWidth = 6
            ctx.strokeRect(x, y, w, h)
            ctx.font = 'bold 30px system-ui, sans-serif'
            const label = `${NAMES[lang][p.class] ?? p.class} · ${t(pos)}`
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
            best = { key: `${p.class}-${pos}`, cls: p.class, pos, close, area, importance }
          }
        }
        history.current = [...history.current.slice(-2), frameKeys]
        if (best && history.current.filter((k) => k.has(best!.key)).length >= 2) {
          const b = best
          const sameAgo = now - (lastSaid.current.get(b.key) ?? 0)
          const anyAgo = now - lastAny.current
          if (sameAgo > 8000 && anyAgo > (b.close ? 2500 : 5000)) {
            lastSaid.current.set(b.key, now)
            lastAny.current = now
            if (speakingNow() === 'answer' || isBusy()) {
              // never talk over an answer: a close thing gets a warning beep instead of words
              if (b.close) beep(440, 160, 0.3)
            } else {
              const n = preds.filter((q) => q.class === b.cls && q.score >= 0.55).length
              const name = b.cls === 'person' && n > 1 ? `${n} ${PEOPLE[lang]}` : NAMES[lang][b.cls] ?? b.cls
              const text = `${name} ${POS[lang][b.pos]}${b.close ? CLOSE[lang] : ''}.`
              say(lang === 'en' ? text.charAt(0).toUpperCase() + text.slice(1) : text, b.close ? 'alert' : 'info')
            }
          }
        }
        // ---- proximity feel (separate from speech, every frame): the closer, the faster and stronger ----
        // nearest thing = biggest box in the middle 70% of the view (things at the very edge are not in the way)
        let near = 0
        for (const p of preds) {
          const [bx, , w, h] = p.bbox
          const cx = (bx + w / 2) / W
          if (cx < 0.15 || cx > 0.85) continue
          near = Math.max(near, (w * h) / (W * H))
        }
        const level = near >= 0.45 ? 3 : near >= 0.25 ? 2 : near >= 0.12 ? 1 : 0
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
