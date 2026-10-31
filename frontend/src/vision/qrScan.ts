// Looks for a QR code in the live camera: the phone's built-in detector (Chrome on Android), or jsQR as a fallback.
// Talks the person in ("hold it closer") and gives up after 25 s.
import { say } from '../core/speech'
import { t } from '../i18n/phrases'

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

async function makeDecoder(): Promise<(c: HTMLCanvasElement) => Promise<string | null>> {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
  if (BD) {
    try {
      const d = new BD({ formats: ['qr_code'] })
      return async (c) => (await d.detect(c))[0]?.rawValue ?? null
    } catch { /* not supported here: use jsQR */ }
  }
  const jsQR = (await import('jsqr')).default
  return async (c) => {
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    const img = ctx.getImageData(0, 0, c.width, c.height)
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

export function startQrScan(video: HTMLVideoElement, onFound: (text: string) => void, onGiveUp: () => void): () => void {
  let active = true
  const c = document.createElement('canvas')
  const started = Date.now()
  let lastHint = Date.now()
  say(t('qrLooking'), 'answer')
  void makeDecoder().then((decode) => {
    const step = async () => {
      if (!active) return
      if (video.readyState >= 2 && video.videoWidth) {
        const k = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight))
        c.width = Math.round(video.videoWidth * k); c.height = Math.round(video.videoHeight * k)
        c.getContext('2d', { willReadFrequently: true })?.drawImage(video, 0, 0, c.width, c.height)
        const text = await decode(c).catch(() => null)
        if (!active) return
        if (text) { active = false; onFound(text); return }
      }
      const now = Date.now()
      if (now - started > 25000) { active = false; say(t('qrNotFound'), 'answer'); onGiveUp(); return }
      if (now - lastHint > 6000) { lastHint = now; say(t('qrHint'), 'info') }
      setTimeout(() => void step(), 200)
    }
    void step()
  })
  return () => { active = false }
}
