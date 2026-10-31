// What the app is saying + a status chip that always shows the real current state.
// Alert style only while an alert is being spoken. Finished captions go muted, then clear after 4 s.
import { useEffect, useState } from 'react';
import Icon, { type IconName } from './Icon';
import type { Caption } from '../core/speech';

export type Status = 'ready' | 'thinking' | 'speaking' | 'offline' | 'listening';
const STATUS: Record<Status, { icon: IconName; word: string }> = {
  ready: { icon: 'check', word: 'Ready' },
  thinking: { icon: 'spinner', word: 'Thinking' },
  speaking: { icon: 'wave', word: 'Speaking' },
  offline: { icon: 'offline', word: 'Offline' },
  listening: { icon: 'mic', word: 'Listening' },
};

export default function CaptionBar({ caption, status }: { caption: Caption; status: Status }) {
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    setCleared(false);
    if (caption.speaking) return;
    const id = setTimeout(() => setCleared(true), 4000);
    return () => clearTimeout(id);
  }, [caption]);

  const alert = caption.speaking && caption.priority === 'alert';
  const s = STATUS[status];
  const text = cleared ? '' : caption.text;
  return (
    <div className={`caption${alert ? ' alert' : ''}`}>
      <span className={`chip status ${status}`}>
        <Icon name={s.icon} size={18} className={status === 'thinking' ? 'spin' : undefined} />{s.word}
      </span>
      {/* aria-live per spec. NOTE: with TalkBack on, this repeats what the app already speaks aloud. */}
      <p className={`caption-text${caption.speaking ? '' : ' done'}`} role="status" aria-live="polite">
        {alert && <Icon name="warning" size={30} className="caption-icon" />}
        {text}
      </p>
    </div>
  );
}
