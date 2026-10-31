// One half of the screen. Large, labelled for TalkBack (aria-label).
type Props = { label: string; active: boolean; onActivate: () => void };

export default function HalfButton({ label, active, onActivate }: Props) {
  return (
    <button className={active ? 'half active' : 'half'} aria-label={label} aria-pressed={active} onClick={onActivate}>
      {label}
    </button>
  );
}
