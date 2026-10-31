// Bin finder: after /waste says which bin, look for that colour in the camera feed and guide the user
// with beeps (faster = closer) and short spoken directions. Runs on the phone.
import { createBeeper } from '../core/audio'
import { say } from '../core/speech'
import { t } from '../i18n/phrases'

export type BinColor = 'blue' | 'green' | 'red'

function matches(color: BinColor, r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const v = max / 255, s = max === 0 ? 0 : (max - min) / max
  if (s < 0.35 || v < 0.2) return false
  let h = 0
  const d = max - min
  if (d === 0) return false
  if (max === r) h = 60 * (((g - b) / d) % 6)
  else if (max === g) h = 60 * ((b - r) / d + 2)
  else h = 60 * ((r - g) / d + 4)
  if (h < 0) h += 360
  if (color === 'blue') return h >= 190 && h <= 250
  if (color === 'green') return h >= 80 && h <= 160
  return h <= 15 || h >= 345
}

export function startBinFinder(video: HTMLVideoElement, color: BinColor): () => void {
  const W = 64, H = 48
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const beeper = createBeeper()
  const name = t(color)
  let active = true
  let lastSay = 0
  let lastDir = ''
  say(t('binSearch', { bin: name }), 'answer')

  const step = () => {
    if (!active || !ctx) return
    if (video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, W, H)
      const px = ctx.getImageData(0, 0, W, H).data
      let n = 0, sx = 0
      for (let i = 0, p = 0; i < px.length; i += 4, p++) {
        if (matches(color, px[i], px[i + 1], px[i + 2])) { n++; sx += p % W }
      }
      const cover = n / (W * H)
      const now = Date.now()
      if (cover < 0.02) {
        beeper.set(0)
        if (now - lastSay > 5000) { lastSay = now; lastDir = ''; say(t('binNotSeen', { bin: name }), 'info') }
      } else {
        beeper.set(Math.min(1, cover * 3))
        const cx = sx / n / W
        const dir = cover > 0.3 ? 'binClose' : cx < 0.38 ? 'binLeft' : cx > 0.62 ? 'binRight' : 'binAhead'
        if (dir !== lastDir || now - lastSay > 4000) {
          lastDir = dir; lastSay = now
          say(t(dir as 'binClose' | 'binLeft' | 'binRight' | 'binAhead', { bin: name }), 'info')
        }
      }
    }
    setTimeout(step, 250)
  }
  step()
  return () => { active = false; beeper.stop() }
}
