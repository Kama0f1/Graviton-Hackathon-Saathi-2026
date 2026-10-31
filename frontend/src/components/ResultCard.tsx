// The big answer card. Warnings are red with an icon + words (never colour alone).
import type { ResultView } from '../core/result'

const ICON = { info: 'ℹ', warning: '⚠', success: '✓' } as const

export default function ResultCard({ r }: { r: ResultView | null }) {
  if (!r) return null
  return (
    <section className={`result result-${r.tone}`} aria-live="polite">
      <div className="result-label">
        <span aria-hidden="true">{ICON[r.tone]}</span> {r.label}
        {r.swatch && <span className={`swatch swatch-${r.swatch}`} aria-hidden="true" />}
      </div>
      <p className="result-headline">{r.headline}</p>
      {r.detail && <p className="result-detail">{r.detail}</p>}
      {r.chips && r.chips.length > 0 && (
        <ul className="chips">{r.chips.map((c) => <li key={c}>{c}</li>)}</ul>
      )}
      {r.items && r.items.length > 0 && (
        <ul className="items">
          {r.items.map((i, n) => (<li key={n}><span>{i.name}</span><b>{i.amount}</b></li>))}
        </ul>
      )}
    </section>
  )
}
