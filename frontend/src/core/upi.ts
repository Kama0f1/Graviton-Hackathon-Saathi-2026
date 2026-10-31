// UPI QR safety check: what a payment QR really pays to. Everything here runs on the phone (works offline).
// A UPI QR holds a link like  upi://pay?pa=sharma@okicici&pn=Sharma%20Kirana&am=250&cu=INR
//   pa = UPI ID (where the money goes), pn = payee name, am = amount asked for (optional).
export type QrInfo =
  | { kind: 'upi'; name: string; vpa: string; amount: number | null }
  | { kind: 'url'; url: string; host: string }
  | { kind: 'text'; text: string }

export function parseQr(raw: string): QrInfo {
  const text = raw.trim()
  if (/^upi:\/\//i.test(text)) {
    const q = new URLSearchParams(text.slice(text.indexOf('?') + 1))
    const am = Number(q.get('am') ?? '')
    return { kind: 'upi', name: (q.get('pn') ?? '').trim(), vpa: (q.get('pa') ?? '').trim(), amount: am > 0 ? am : null }
  }
  if (/^https?:\/\//i.test(text)) {
    try { return { kind: 'url', url: text, host: new URL(text).hostname.replace(/^www\./, '') } } catch { /* not a URL */ }
  }
  return { kind: 'text', text: text.slice(0, 200) }
}

/** "sharma.kirana@okicici" -> "sharma kirana at okicici" (read naturally by the voice) */
export const sayVpa = (vpa: string) => vpa.replace('@', ' at ').replace(/[._-]+/g, ' ')

/** Does the QR's payee look like the shop on the bill? Any shared word of 3+ letters counts. */
export function sameShop(shop: string, name: string, vpa: string): boolean {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-੿ ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3)
  const target = new Set([...words(name), ...words(vpa.split('@')[0].replace(/[._-]/g, ' '))])
  const skip = new Set(['store', 'stores', 'shop', 'mart', 'general', 'kirana', 'traders', 'enterprises', 'the'])
  return words(shop).some((w) => !skip.has(w) && (target.has(w) || [...target].some((x) => x.includes(w))))
}
