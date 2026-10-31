// React view of the app settings: re-renders when any setting changes.
import { useEffect, useState } from 'react'
import { getHazards, getObstacles, getSpeed, getVibrate, onSettings } from './settings'

export function useSettings() {
  const [, bump] = useState(0)
  useEffect(() => onSettings(() => bump((n) => n + 1)), [])
  return { obstacles: getObstacles(), hazards: getHazards(), vibrate: getVibrate(), speed: getSpeed() }
}
