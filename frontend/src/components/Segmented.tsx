// Pill-shaped picker (one choice). Each option is a real button with aria-pressed.
export default function Segmented<T extends string>({ items, value, onChange, label }: {
  items: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map((it) => (
        <button key={it.id} type="button" className={it.id === value ? 'on' : ''} aria-pressed={it.id === value}
          onClick={() => onChange(it.id)}>{it.label}</button>
      ))}
    </div>
  )
}
