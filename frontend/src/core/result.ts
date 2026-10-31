// Turns backend answers into what the result card shows. The spoken sentence always comes from the backend.
import type { MoneyResult, ReadResult, SignResult, SpeechOnly, WasteResult } from './api'

export type Tone = 'info' | 'warning' | 'success'
export type ResultView = {
  tone: Tone
  label: string                       // small caps label: "BILL", "MONEY", ...
  headline: string                    // one huge line
  detail?: string                     // second line / reason
  chips?: string[]                    // small facts
  items?: { name: string; amount: string }[]
  swatch?: 'blue' | 'green' | 'red'
}

const SYMBOL: Record<string, string> = { INR: '₹', EUR: '€', USD: '$', GBP: '£' }
export const money = (x: number | null | undefined, cur = 'INR') => {
  if (x == null) return ''
  const s = Number.isInteger(x) ? x.toLocaleString('en-IN') : x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (SYMBOL[cur] ?? cur + ' ') + s
}
const REASON: Record<string, string> = {
  not_rbi: 'No "Reserve Bank of India" text', toy_text: 'Toy / film-prop wording',
  photocopy: 'Looks like a photocopy', mismatch: 'Design or colour does not match', other: 'Something looks wrong',
}

export function fromRead(r: ReadResult): ResultView {
  if (r.kind === 'bill' && r.bill) {
    const b = r.bill, cur = b.currency
    const retake = r.uncertain.includes('printed_total') || r.uncertain.includes('items') || !b.items.length
    const extra = b.printed_total != null && b.computed_total != null ? b.printed_total - b.computed_total : 0
    return {
      tone: retake ? 'warning' : b.mismatch ? 'warning' : 'success',
      label: 'BILL',
      headline: retake ? 'Please retake the photo'
        : b.mismatch ? `${money(Math.abs(extra), cur)} ${extra > 0 ? 'overcharged' : 'undercharged'}`
        : `Total ${money(b.printed_total ?? b.computed_total, cur)} ✓`,
      detail: b.mismatch && !retake
        ? `Items add up to ${money(b.computed_total, cur)}, bill says ${money(b.printed_total, cur)}`
        : [b.shop, `${b.items.length} items`].filter(Boolean).join(' · '),
      items: b.items.map((i) => ({ name: [i.name, i.qty && i.qty !== 1 ? `× ${i.qty}` : ''].filter(Boolean).join(' '), amount: money(i.amount, cur) })),
      chips: r.uncertain.includes('multiple_bills') ? ['More than one bill in photo'] : undefined,
    }
  }
  return {
    tone: 'info',
    label: (r.doc_type || 'document').toUpperCase(),
    headline: r.speech,
    chips: Object.entries(r.key_fields).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`),
  }
}

export function fromMoney(m: MoneyResult): ResultView {
  const cur = m.currency
  const label = m.mode === 'check' ? 'NOTE CHECK' : m.mode === 'change' ? 'CHANGE' : 'MONEY'
  const chips = m.items.map((i) => `${money(i.value, cur)} × ${i.count}`)
  if (m.suspicious.length) {
    return { tone: 'warning', label, headline: `${money(m.suspicious[0].value, cur)} note may be fake`,
      detail: `${REASON[m.suspicious[0].reason]}. Do not accept it.`, chips }
  }
  if (m.unclear) return { tone: 'warning', label, headline: 'Spread the notes out and retake', chips }
  if (m.mode === 'check') return { tone: 'success', label, headline: 'No obvious signs of a fake', detail: 'Check large amounts with a bank.', chips }
  if (m.mode === 'change' && m.difference != null) {
    if (Math.abs(m.difference) <= 0.5) return { tone: 'success', label, headline: `Correct change ✓ ${money(m.total, cur)}`, chips }
    return {
      tone: m.difference < 0 ? 'warning' : 'info', label,
      headline: `${money(Math.abs(m.difference), cur)} ${m.difference < 0 ? 'short' : 'extra'}`,
      detail: `Expected ${money(m.expected_change, cur)}, got ${money(m.total, cur)}`, chips,
    }
  }
  return {
    tone: 'info', label, headline: `Total ${money(m.total, cur)}`,
    detail: m.expected_change != null && m.expected_change > 0 ? `Change due: ${money(m.expected_change, cur)}` : m.speech,
    chips,
  }
}

export const fromWaste = (w: WasteResult): ResultView => ({
  tone: w.bin_color ? 'success' : 'warning', label: 'WASTE',
  headline: w.bin_color ? `${w.bin_color[0].toUpperCase() + w.bin_color.slice(1)} bin` : 'Not sure which bin',
  detail: `${w.item} · ${w.category} waste`, swatch: w.bin_color ?? undefined,
})
export const fromSign = (s: SignResult): ResultView => ({ tone: s.confident ? 'info' : 'warning', label: 'SIGN', headline: s.text || s.speech, detail: s.confident ? undefined : 'Part of the sign was unclear' })
export const fromSpeech = (label: string, s: SpeechOnly): ResultView => ({ tone: 'info', label, headline: s.speech })
