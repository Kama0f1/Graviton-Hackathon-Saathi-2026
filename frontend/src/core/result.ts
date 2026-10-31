// Turns backend answers into what the result card shows. The spoken sentence always comes from the backend.
import type { MoneyResult, ReadResult, SignResult, SpeechOnly, WasteResult } from './api'
import { t, type PhraseKey } from '../i18n/phrases'

export type Tone = 'info' | 'warning' | 'success'
export type ResultView = {
  tone: Tone
  label: string                       // short label: "Bill", "Money", ...
  headline: string                    // one huge line
  detail?: string                     // second line / reason
  chips?: string[]                    // small facts
  items?: { name: string; amount: string }[]
  swatch?: 'blue' | 'green' | 'red'
}

/** A result card that is (re)built when shown, so it follows the current language. */
export type ResultSrc = { make: () => ResultView }
export const src = (make: () => ResultView): ResultSrc => ({ make })

const SYMBOL: Record<string, string> = { INR: '₹', EUR: '€', USD: '$', GBP: '£' }
export const money = (x: number | null | undefined, cur = 'INR') => {
  if (x == null) return ''
  const s = Number.isInteger(x) ? x.toLocaleString('en-IN') : x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (SYMBOL[cur] ?? cur + ' ') + s
}
export function fromRead(r: ReadResult): ResultView {
  if (r.kind === 'bill' && r.bill) {
    const b = r.bill, cur = b.currency
    const retake = r.uncertain.includes('printed_total') || r.uncertain.includes('items') || !b.items.length
    const extra = b.printed_total != null && b.computed_total != null ? b.printed_total - b.computed_total : 0
    return {
      tone: retake || b.mismatch ? 'warning' : 'success',
      label: t('lblBill'),
      headline: retake ? t('retake')
        : b.mismatch ? t(extra > 0 ? 'overcharged' : 'undercharged', { n: money(Math.abs(extra), cur) })
        : t('totalOk', { n: money(b.printed_total ?? b.computed_total, cur) }),
      detail: b.mismatch && !retake
        ? t('itemsAddUp', { a: money(b.computed_total, cur), b: money(b.printed_total, cur) })
        : [b.shop, t('itemsN', { n: b.items.length })].filter(Boolean).join(' · '),
      items: b.items.map((i) => ({ name: [i.name, i.qty && i.qty !== 1 ? `× ${i.qty}` : ''].filter(Boolean).join(' '), amount: money(i.amount, cur) })),
      chips: r.uncertain.includes('multiple_bills') ? [t('multipleBills')] : undefined,
    }
  }
  return {
    tone: 'info',
    label: r.doc_type ? r.doc_type.charAt(0).toUpperCase() + r.doc_type.slice(1) : t('lblDoc'),
    headline: r.speech,
    chips: Object.entries(r.key_fields).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`),
  }
}

export function fromMoney(m: MoneyResult): ResultView {
  const cur = m.currency
  const label = m.mode === 'check' ? t('lblNote') : m.mode === 'change' ? t('lblChange') : t('money')
  const chips = m.items.map((i) => `${money(i.value, cur)} × ${i.count}`)
  if (m.suspicious.length) {
    const why = `r_${m.suspicious[0].reason}` as PhraseKey
    return { tone: 'warning', label, headline: t('mayBeFake', { n: money(m.suspicious[0].value, cur) }),
      detail: `${t(why)}. ${t('doNotAccept')}`, chips }
  }
  if (m.unclear) return { tone: 'warning', label, headline: t('spreadRetake'), chips }
  if (m.mode === 'check') return { tone: 'success', label, headline: t('noObviousFake'), detail: t('checkBank'), chips }
  if (m.mode === 'change' && m.difference != null) {
    if (Math.abs(m.difference) <= 0.5) return { tone: 'success', label, headline: t('correctChange', { n: money(m.total, cur) }), chips }
    return {
      tone: m.difference < 0 ? 'warning' : 'info', label,
      headline: t(m.difference < 0 ? 'shortBy' : 'extraBy', { n: money(Math.abs(m.difference), cur) }),
      detail: t('expectedGot', { a: money(m.expected_change, cur), b: money(m.total, cur) }), chips,
    }
  }
  return {
    tone: 'info', label, headline: t('totalN', { n: money(m.total, cur) }),
    detail: m.expected_change != null && m.expected_change > 0 ? t('changeDue', { n: money(m.expected_change, cur) }) : m.speech,
    chips,
  }
}

export const fromWaste = (w: WasteResult): ResultView => ({
  tone: w.bin_color ? 'success' : 'warning', label: t('lblWaste'),
  headline: w.bin_color ? t('binName', { c: t(w.bin_color) }) : t('notSureBin'),
  detail: `${w.speech.split('.')[0]} · ${t(`cat_${w.category}` as PhraseKey)}`, swatch: w.bin_color ?? undefined,
})
export const fromSign = (s: SignResult): ResultView => ({ tone: s.confident ? 'info' : 'warning', label: t('lblSign'), headline: s.text || s.speech, detail: s.confident ? undefined : t('signUnclear') })
export const fromSpeech = (label: string, s: SpeechOnly): ResultView => ({ tone: 'info', label, headline: s.speech })
