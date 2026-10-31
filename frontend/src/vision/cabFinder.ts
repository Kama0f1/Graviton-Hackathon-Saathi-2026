// "Is this my cab?": while the person points the phone at the road, a frame goes to /cab every couple of seconds.
// The AI reads the number plates; the server matches them to the booked plate (a misread letter still matches).
import { api, type CabResult } from '../core/api'
import { haptics } from '../core/haptics'
import { say } from '../core/speech'
import { t } from '../i18n/phrases'

export function startCabFinder(grab: (maxSide?: number, quality?: number) => Promise<Blob | null>, plate: string,
  onResult: (r: CabResult) => void): () => void {
  let active = true
  let lastKey = ''
  let lastSay = 0
  say(t('cabLooking', { plate: plate.split('').join(' ') }), 'answer')

  const step = async () => {
    if (!active) return
    try {
      const img = await grab(1280, 0.85)
      const r = img ? await api.cab(img, plate) : null
      if (!active) return
      if (r) {
        onResult(r)
        const now = Date.now()
        const key = r.match ? `yes-${r.position}-${r.metres}` : r.plates.join(',') || r.speech
        // a match is said at once (and repeated as it moves); "not yours" / "no plate" only when it changes, or every 8 s
        if (key !== lastKey || now - lastSay > (r.match ? 5000 : 8000)) {
          lastKey = key; lastSay = now
          if (r.match) haptics.success()
          say(r.speech, r.match ? 'answer' : 'info')
        }
      }
    } catch { /* slow frame: try the next one */ }
    if (active) setTimeout(() => void step(), 1000)
  }
  void step()
  return () => { active = false }
}
