// The answer card: a gradient card with one big line. Warnings also say so in words (never colour alone).
import type { ResultSrc } from '../core/result'
import Icon from './Icon'
import { t } from '../i18n/phrases'

const ACCENT = { info: 'purple', success: 'green', warning: 'coral' } as const

export default function ResultCard({ src, onClose }: { src: ResultSrc | null; onClose?: () => void }) {
  if (!src) return null
  const r = src.make() // built at render time, so switching language re-labels the card
  const accent = r.accent ?? ACCENT[r.tone]
  return (
    <section className="result" aria-live="polite">
      <div className={`hero g-${accent}`}>
        <div className="hero-top">
          <span className="hero-label">
            {r.tone === 'warning' && <Icon name="warn" size={18} />}
            {r.tone === 'success' && <Icon name="check" size={18} />}
            {r.label}
          </span>
          {r.swatch && <span className={`swatch swatch-${r.swatch}`} aria-hidden="true" />}
          {onClose && <button type="button" className="hero-close" onClick={onClose} aria-label={t('close')}><Icon name="x" size={20} /></button>}
        </div>
        <p className="hero-headline">{r.headline}</p>
        {r.detail && <p className={r.compare ? 'sr-only' : 'hero-detail'}>{r.detail}</p>}
        {r.chips && r.chips.length > 0 && <ul className="hero-chips">{r.chips.map((c) => <li key={c}>{c}</li>)}</ul>}
      </div>
      {r.compare && (
        <div className="compare" aria-hidden="true">
          {r.compare.map((c, i) => (
            <div key={c.label} className={`hero small g-${i ? 'coral' : 'blue'}`}>
              <span className="hero-label">{c.label}</span>
              <b>{c.value}</b>
            </div>
          ))}
        </div>
      )}
      {r.items && r.items.length > 0 && (
        <div className="card items-card">
          <h3 className="card-title">{t('itemsTitle')}</h3>
          <ul className="items">
            {r.items.map((i, n) => (<li key={n}><span>{i.name}</span><b>{i.amount}</b></li>))}
          </ul>
        </div>
      )}
    </section>
  )
}
