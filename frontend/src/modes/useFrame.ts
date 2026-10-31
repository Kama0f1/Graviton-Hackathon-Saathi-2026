// Starts the camera if needed and waits (up to ~3 s) for a real frame.
import type { Camera } from '../core/camera'
import { say } from '../core/speech'
import { t } from '../i18n/phrases'

export async function frame(cam: Camera, maxSide = 1280, quality = 0.85): Promise<Blob | null> {
  if (!(await cam.start())) { say(cam.error || t('cameraOff'), 'answer'); return null }
  for (let i = 0; i < 15; i++) {
    const b = await cam.grab(maxSide, quality)
    if (b) return b
    await new Promise((r) => setTimeout(r, 200))
  }
  say(t('noFrame'), 'answer')
  return null
}
