// Hazard watch: while Navigate mode is open, a small frame goes to /hazard every few seconds and the AI looks for
// what the phone-side detector cannot see: stairs, steps, kerbs, walls, glass, poles, potholes, open drains.
// It only sends when the view has changed (you are moving), and it only speaks when something new and near shows up.
import { useEffect, useRef, useState } from 'react'
import { api, isBusy, type HazardResult } from '../core/api'
import { say, speakingNow } from '../core/speech'
import { haptics } from '../core/haptics'
import { beep } from '../core/audio'
import { canVibrate, getVibrate } from '../core/settings'

const EVERY_MS = 4000        // at most one check per 4 s (keeps within the free AI quota)
const STILL_EVERY_MS = 15000 // standing still: one check per 15 s
const DROPS = new Set(['stairs_down', 'step_down', 'kerb', 'open_drain', 'pothole'])
const PHONE_SEES = new Set(['person', 'vehicle', 'two_wheeler', 'animal']) // the on-phone detector already covers these

// tiny grey thumbnail, to tell whether the view changed since the last check
function thumb(video: HTMLVideoElement, c: HTMLCanvasElement): Uint8ClampedArray | null {
  if (!video.videoWidth) return null
  c.width = 24; c.height = 18
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, 24, 18)
  return ctx.getImageData(0, 0, 24, 18).data
}
function changed(a: Uint8ClampedArray | null, b: Uint8ClampedArray | null) {
  if (!a || !b) return true
  let d = 0
  for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] + a[i + 1] + a[i + 2] - b[i] - b[i + 1] - b[i + 2]) / 3
  return d / (a.length / 4) > 8
}

export function useHazardWatch(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  grab: (maxSide?: number, quality?: number) => Promise<Blob | null>,
  enabled: boolean,
) {
  const [last, setLast] = useState<(HazardResult & { at: number }) | null>(null)
  const said = useRef(new Map<string, { at: number; metres: number }>())

  useEffect(() => {
    if (!enabled) return
    let active = true
    let timer: number | undefined
    let lastSent = 0
    let lastThumb: Uint8ClampedArray | null = null
    const canvas = document.createElement('canvas')

    const tickFn = async () => {
      if (!active) return
      const v = videoRef.current
      const now = Date.now()
      const th = v ? thumb(v, canvas) : null
      const moved = changed(th, lastThumb)
      const due = now - lastSent >= (moved ? EVERY_MS : STILL_EVERY_MS)
      // never compete with a question the person asked (that answer matters more), never when hidden
      if (v && th && due && !isBusy() && document.visibilityState === 'visible') {
        lastSent = now
        lastThumb = th
        try {
          const img = await grab(512, 0.7)
          const r = img ? await api.hazard(img) : null
          if (active && r) handle(r)
        } catch { /* slow / offline frame: just try the next one */ }
      }
      if (active) timer = window.setTimeout(tickFn, 700)
    }

    const handle = (r: HazardResult) => {
      if (r.hazard === 'none' || !r.speech) { setLast(null); return }
      const now = Date.now()
      setLast({ ...r, at: now })
      const key = `${r.hazard}-${r.position}`
      const prev = said.current.get(key)
      // same thing again: only repeat if it got at least 1 m closer, or after 12 s
      if (prev && now - prev.at < 12000 && r.metres > prev.metres - 1) return
      if (PHONE_SEES.has(r.hazard) && !r.urgent) return
      said.current.set(key, { at: now, metres: r.metres })
      if (r.urgent) {
        // drops get their own feel: two long buzzes; anything else: one strong buzz
        if (canVibrate() && getVibrate()) { if (DROPS.has(r.hazard)) haptics.warning(); else haptics.veryNear() }
        else beep(DROPS.has(r.hazard) ? 330 : 520, 220, 0.3)
        say(r.speech, 'alert')
      } else if (speakingNow() !== 'answer') {
        say(r.speech, 'info')
      }
    }

    timer = window.setTimeout(tickFn, 1500)
    return () => { active = false; if (timer !== undefined) clearTimeout(timer) }
  }, [enabled, videoRef, grab])

  // forget an old hazard on screen after 6 s
  const fresh = last && Date.now() - last.at < 6000 ? last : null
  return fresh
}
