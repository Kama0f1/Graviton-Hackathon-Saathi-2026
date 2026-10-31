// "Where is the bin?": while the person turns slowly, a frame goes to /findbin every couple of seconds and the AI
// says where a dustbin is (left / ahead / right, metres). Works for any bin, not only blue/green/red ones.
// Between answers a beep gets faster as the bin gets closer.
import { api } from '../core/api'
import { createBeeper } from '../core/audio'
import { haptics } from '../core/haptics'
import { say } from '../core/speech'
import { t } from '../i18n/phrases'

export function startAiBinFinder(grab: (maxSide?: number, quality?: number) => Promise<Blob | null>, color: string | null): () => void {
  const beeper = createBeeper()
  let active = true
  let lastKey = ''
  let lastSay = 0
  let misses = 0
  say(t('binLooking'), 'answer')

  const step = async () => {
    if (!active) return
    try {
      const img = await grab(640, 0.75)
      const r = img ? await api.findBin(img, color) : null
      if (!active) return
      if (r) {
        const now = Date.now()
        if (!r.found) {
          misses++
          beeper.set(0)
          // "no bin" only now and then, so it does not nag while turning
          if (misses >= 2 && now - lastSay > 7000) { lastSay = now; lastKey = ''; say(r.speech, 'info') }
        } else {
          misses = 0
          beeper.set(Math.max(0.1, 1 - r.metres / 6))
          const key = `${r.position}-${r.metres}`
          if (key !== lastKey || now - lastSay > 5000) {
            const reached = r.metres < 0.75
            lastKey = key; lastSay = now
            if (reached) haptics.success()
            say(r.speech, reached ? 'answer' : 'info')
          }
        }
      }
    } catch { /* slow or failed frame: try the next one */ }
    if (active) setTimeout(() => void step(), 1200)
  }
  void step()
  return () => { active = false; beeper.stop() }
}
