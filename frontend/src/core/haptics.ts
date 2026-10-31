// Vibration patterns (Android Chrome). iPhone browsers ignore vibration. Respects the on/off setting.
import { canVibrate, getVibrate } from './settings'

const buzz = (p: number | number[]) => { if (canVibrate() && getVibrate()) navigator.vibrate(p) }
export const haptics = {
  navigate: () => buzz(100),                   // 1 buzz
  read: () => buzz([100, 100, 100]),           // 2 buzzes
  tap: () => buzz(30),
  success: () => buzz([60, 60, 60]),
  warning: () => buzz([250, 120, 250, 120, 250]),
  near: () => buzz(150),
  veryNear: () => buzz([200, 100, 200]),
  test: () => { if (canVibrate()) navigator.vibrate([200, 100, 200]) }, // works even when off, for the test button
  stop: () => { if (canVibrate()) navigator.vibrate(0) },
}
