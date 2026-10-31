// The answer card. Warnings are a red block with words (never colour alone).
import type { ResultSrc } from '../core/result'

export default function ResultCard({ src }: { src: ResultSrc | null }) {
  if (!src) return null
  const r = src.make() // built at render time, so switching language re-labels the card
  return (
    <section className={`result result-${r.tone}`} aria-live="polite">
      <div className="result-label">
        {r.tone === 'warning' && <span aria-hidden="true">!</span>}
        {r.label}
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
