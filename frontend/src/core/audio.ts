// Small Web Audio sounds: beeps, waiting tick, shutter. No audio files needed.
let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

export function beep(freq = 880, ms = 90, volume = 0.15) {
  const a = ac()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.frequency.value = freq
  g.gain.value = volume
  o.connect(g).connect(a.destination)
  o.start()
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000)
  o.stop(a.currentTime + ms / 1000 + 0.02)
}

export const tick = () => beep(1400, 25, 0.05)
export const shutter = () => { beep(1800, 40, 0.2); setTimeout(() => beep(1200, 60, 0.15), 50) }

// Proximity beeper: closeness 0..1 -> beep interval from 900 ms (far) down to 120 ms (very close).
export function createBeeper() {
  let timer: number | undefined
  let closeness = 0
  const loop = () => {
    if (closeness <= 0) { timer = undefined; return }
    beep(700 + closeness * 700, 70)
    timer = window.setTimeout(loop, 900 - closeness * 780)
  }
  return {
    set(c: number) {
      closeness = Math.max(0, Math.min(1, c))
      if (closeness > 0 && timer === undefined) loop()
    },
    stop() { closeness = 0; if (timer !== undefined) clearTimeout(timer); timer = undefined },
  }
}
