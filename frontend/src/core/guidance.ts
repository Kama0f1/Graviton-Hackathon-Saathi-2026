// Guided scan: send a small frame to /guidance every ~1.6 s, speak + show the move when it changes,
// take the real photo after "ready" twice in a row, or anyway after ~20 s so it never gets stuck.
import { api } from './api'
import { say } from './speech'
import { shutter } from './audio'
import { haptics } from './haptics'
import { t } from '../i18n/phrases'

const ARROW: Record<string, string> = { left: '←', right: '→', up: '↑', down: '↓', closer: '⤢', back: '⤡', hold: '■', light: '☀', none: '…' }

export function startGuidance(
  grab: (maxSide?: number, quality?: number) => Promise<Blob | null>,
  onCaptured: (photo: Blob) => void,
  onHint: (hint: { arrow: string; text: string; ready: boolean }) => void,
  target: 'document' | 'bill' = 'document',
): () => void {
  let active = true
  let readyCount = 0
  let lastSpoken = ''
  let lastSpokenAt = 0
  const started = Date.now()
  say(t('guideStart'), 'answer')
  onHint({ arrow: '◎', text: t('guideStart'), ready: false })

  const capture = async () => {
    active = false
    shutter()
    haptics.success()
    const photo = await grab(1600, 0.9)
    if (photo) onCaptured(photo)
  }

  const step = async () => {
    if (!active) return
    if (Date.now() - started > 20000) { say(t('scanTimeout'), 'info'); await capture(); return }
    const frame = await grab(768, 0.7)
    if (frame) {
      try {
        const g = await api.guidance(frame, target)
        if (!active) return
        readyCount = g.ready ? readyCount + 1 : 0
        if (g.speech || g.ready) onHint({ arrow: ARROW[g.move] ?? '…', text: g.speech || t('captured'), ready: g.ready })
        if (readyCount >= 2) { say(t('captured'), 'info'); await capture(); return }
        if (g.speech && g.speech !== lastSpoken && Date.now() - lastSpokenAt > 2500) { lastSpoken = g.speech; lastSpokenAt = Date.now(); say(g.speech, 'info') }
      } catch { /* slow or failed frame: try the next one */ }
    }
    if (active) setTimeout(step, 1600)
  }
  setTimeout(step, 1200)
  return () => { active = false }
}
