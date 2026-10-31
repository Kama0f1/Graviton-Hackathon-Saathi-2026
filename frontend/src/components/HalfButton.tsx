// One half of the screen: one big rounded card / button. TalkBack reads aria-label; double-tap = click.
import Icon, { type IconName } from './Icon';
import CameraView from './CameraView';
import ResultCard from './ResultCard';
import type { ResultView } from '../core/result';

type Props = {
  label: string;      // spoken by TalkBack
  title: string;      // mode name on screen
  hint: string;
  icon: IconName;
  active: boolean;
  result?: ResultView | null;
  onActivate: () => void;
};

export default function HalfButton({ label, title, hint, icon, active, result, onActivate }: Props) {
  return (
    <button className={`half${active ? ' active' : ''}${result ? ' has-result' : ''}`} aria-label={label} aria-pressed={active} onClick={onActivate}>
      {active && <CameraView />}
      <div className="half-body">
        <div className="half-head">
          <Icon name={icon} size={result ? 32 : 56} className="half-icon" />
          <span className="half-title">{title}</span>
          {active && <span className="chip chip-active">Active</span>}
        </div>
        {result ? <ResultCard r={result} /> : <span className="half-hint">{hint}</span>}
      </div>
    </button>
  );
}
