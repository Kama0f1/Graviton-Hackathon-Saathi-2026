// SOS: "help me" / "emergency" or a hard shake -> a full-screen red button. Tapping ANYWHERE on the screen sends the
// live location to the emergency contact on WhatsApp (or SMS). A web app cannot send a message silently, so the person
// confirms with one tap; the whole screen is the button, so it is easy to hit without seeing it.
import { getContact } from './settings'
import { getLang } from './settings'

export type Fix = { lat: number; lon: number; acc: number } | null

/** Start finding the location at once, so it is ready when the person taps. */
export function locateNow(): Promise<Fix> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  })
}

const TEXT = {
  en: (link: string, time: string) => `SOS from Saathi: I need help. My location: ${link} (sent ${time})`,
  hi: (link: string, time: string) => `साथी से SOS: मुझे मदद चाहिए। मेरी लोकेशन: ${link} (${time} पर भेजा)`,
  pa: (link: string, time: string) => `ਸਾਥੀ ਤੋਂ SOS: ਮੈਨੂੰ ਮਦਦ ਚਾਹੀਦੀ ਹੈ। ਮੇਰੀ ਲੋਕੇਸ਼ਨ: ${link} (${time} ਨੂੰ ਭੇਜਿਆ)`,
}

export function sosMessage(fix: Fix): string {
  const link = fix ? `https://maps.google.com/?q=${fix.lat.toFixed(6)},${fix.lon.toFixed(6)} (±${fix.acc} m)` : '(location not available)'
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  return TEXT[getLang()](link, time)
}

/** Opens WhatsApp (or SMS) with the message ready. Must be called from a tap. Returns false if no contact is saved. */
export function sendSos(fix: Fix, via: 'whatsapp' | 'sms' = 'whatsapp'): boolean {
  const { phone } = getContact()
  const text = sosMessage(fix)
  const digits = phone.replace(/[^\d]/g, '')
  if (!digits) {
    if (navigator.share) void navigator.share({ text }).catch(() => undefined)
    return false
  }
  const to = digits.length === 10 ? '91' + digits : digits // a 10-digit Indian mobile number gets +91
  const url = via === 'sms' ? `sms:+${to}?body=${encodeURIComponent(text)}` : `https://wa.me/${to}?text=${encodeURIComponent(text)}`
  window.location.href = url
  return true
}

/** Calls onShake after three hard shakes within 1.5 s (walking never comes close). */
export function watchShake(onShake: () => void): () => void {
  let peaks: number[] = []
  let last = 0
  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity
    if (!a || a.x == null || a.y == null || a.z == null) return
    const g = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
    const now = Date.now()
    if (g > 26 && now - last > 180) {
      last = now
      peaks = [...peaks.filter((t) => now - t < 1500), now]
      if (peaks.length >= 3) { peaks = []; onShake() }
    }
  }
  window.addEventListener('devicemotion', handler)
  return () => window.removeEventListener('devicemotion', handler)
}
