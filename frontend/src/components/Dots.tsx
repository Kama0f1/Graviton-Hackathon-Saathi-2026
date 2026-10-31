// Dot-matrix strip (decorative): columns of dots, the first `v` of each column lit.
export default function Dots({ values, rows, className = '' }: { values: number[]; rows: number; className?: string }) {
  return (
    <div className={`dots ${className}`} aria-hidden="true">
      {values.map((v, i) => (
        <span key={i} className="dots-col">
          {Array.from({ length: rows }, (_, r) => <i key={r} className={rows - r <= v ? 'on' : undefined} />)}
        </span>
      ))}
    </div>
  )
}

/** A bell-shaped strip whose height grows as something gets closer (0 = far, 1 = touching). */
export function closeness(level: number, cols = 18, rows = 7): number[] {
  const mid = (cols - 1) / 2
  return Array.from({ length: cols }, (_, i) => {
    const bell = Math.exp(-(((i - mid) / (cols / 3.2)) ** 2))
    return Math.max(1, Math.round(rows * Math.min(1, Math.max(0.12, level)) * bell))
  })
}
