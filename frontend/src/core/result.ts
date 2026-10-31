// What the active half shows on screen. Modes call showResult(); App renders it.
export type ResultView = {
  tone: 'info' | 'warning' | 'success';
  headline: string;     // one huge line: "₹1,240 due 10 Nov"
  detail?: string;      // reason / second line
  chips?: string[];     // small facts
};

let current: ResultView | null = null;
const listeners = new Set<(r: ResultView | null) => void>();

export function onResult(fn: (r: ResultView | null) => void) {
  listeners.add(fn);
  fn(current);
  return () => { listeners.delete(fn); };
}
export function showResult(r: ResultView | null) {
  current = r;
  listeners.forEach((f) => f(r));
}
