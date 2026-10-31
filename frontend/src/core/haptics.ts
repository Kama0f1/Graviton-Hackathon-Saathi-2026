// Vibration patterns (Android Chrome only; iPhone browsers ignore vibrate).
function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

export const haptics = {
  navigate: () => buzz(150),                 // 1 buzz
  read: () => buzz([150, 120, 150]),         // 2 buzzes
  alert: () => buzz([400, 100, 400]),        // obstacle / warning
  ok: () => buzz(60),
  pulse: (ms = 40) => buzz(ms),              // proximity pulses
};
