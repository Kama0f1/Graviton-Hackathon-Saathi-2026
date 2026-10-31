// Result states: info (surface), warning (alert background), success (green left border + check).
import Icon from './Icon';
import type { ResultView } from '../core/result';

export default function ResultCard({ r }: { r: ResultView }) {
  return (
    <div className={`result ${r.tone}`}>
      <p className="result-headline">
        {r.tone !== 'info' && <Icon name={r.tone === 'warning' ? 'warning' : 'check'} size={36} className="result-icon" />}
        {r.headline}
      </p>
      {r.detail && <p className="result-detail">{r.detail}</p>}
      {r.chips?.length ? <div className="result-chips">{r.chips.map((c) => <span key={c} className="chip">{c}</span>)}</div> : null}
    </div>
  );
}
