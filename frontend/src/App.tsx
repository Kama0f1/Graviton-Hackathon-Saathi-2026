// 2-half screen: top = Navigate, bottom = Read, caption bar between.
// Tap the other half = switch mode (buzz + spoken). Tap the active half = its main action.
import { useEffect, useState } from 'react';
import HalfButton from './components/HalfButton';
import CaptionBar, { type Status } from './components/CaptionBar';
import { api, onBusy } from './core/api';
import { onCaption, say, stop, type Caption } from './core/speech';
import { onResult, showResult, type ResultView } from './core/result';
import { haptics } from './core/haptics';
import { t } from './i18n/phrases';

export type Mode = 'navigate' | 'read';

let greeted = false; // StrictMode runs effects twice in dev

export default function App() {
  const [mode, setMode] = useState<Mode>('navigate');
  const [caption, setCaption] = useState<Caption>({ text: '', priority: 'info', speaking: false });
  const [result, setResult] = useState<ResultView | null>(null);
  const [busy, setBusy] = useState(0);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const offs = [onCaption(setCaption), onBusy(setBusy), onResult(setResult)];
    if (!greeted) { greeted = true; say(t('ready'), 'info'); }
    const check = () => api.health().then(setOnline);
    check();
    const id = setInterval(check, 15000);
    return () => { offs.forEach((f) => f()); clearInterval(id); };
  }, []);

  function activate(m: Mode) {
    if (m !== mode) {
      setMode(m);
      stop();
      showResult(null);
      m === 'navigate' ? haptics.navigate() : haptics.read();
      say(t(m), 'answer');
      return;
    }
    say(t(m), 'answer'); // step 2+: main action of the active mode
  }

  // Real current state, in priority order. Never "ready" while something is being spoken.
  const status: Status = caption.speaking ? 'speaking' : busy > 0 ? 'thinking' : !online ? 'offline' : 'ready';

  return (
    <main className={`app${result ? (mode === 'navigate' ? ' result-top' : ' result-bottom') : ''}`}>
      <HalfButton
        icon="navigate" title="Navigate"
        active={mode === 'navigate'}
        result={mode === 'navigate' ? result : null}
        label={mode === 'navigate' ? 'Navigate mode, active. Double tap: what is in front of me.' : 'Navigate mode. Double tap to switch.'}
        hint={mode === 'navigate' ? 'Tap: what’s ahead' : 'Double-tap to switch'}
        onActivate={() => activate('navigate')}
      />
      <CaptionBar caption={caption} status={status} />
      <HalfButton
        icon="read" title="Read"
        active={mode === 'read'}
        result={mode === 'read' ? result : null}
        label={mode === 'read' ? 'Read mode, active. Double tap: read this.' : 'Read mode. Double tap to switch.'}
        hint={mode === 'read' ? 'Tap: read this' : 'Double-tap to switch'}
        onActivate={() => activate('read')}
      />
    </main>
  );
}
