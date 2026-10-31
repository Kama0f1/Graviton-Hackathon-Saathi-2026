// 2-half screen: top = Navigate, bottom = Read.
// TalkBack: touch = speak label, double-tap = activate. No TalkBack: single tap.
// TODO: mode switching, haptic pattern + spoken mode name, hold-anywhere voice.
import { useState } from 'react';
import NavigateMode from './modes/NavigateMode';
import ReadMode from './modes/ReadMode';
import HalfButton from './components/HalfButton';
import LiveAnnouncer from './components/LiveAnnouncer';

export type Mode = 'navigate' | 'read';

export default function App() {
  const [mode, setMode] = useState<Mode>('navigate');
  return (
    <main className="app">
      <HalfButton label="Navigate mode" active={mode === 'navigate'} onActivate={() => setMode('navigate')} />
      <HalfButton label="Read mode" active={mode === 'read'} onActivate={() => setMode('read')} />
      {mode === 'navigate' ? <NavigateMode /> : <ReadMode />}
      <LiveAnnouncer />
    </main>
  );
}
