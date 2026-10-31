// Live camera card with an optional drawing layer (obstacle boxes) and a status chip. Used by both modes.
import type { ReactNode, RefObject } from 'react'
import type { Camera } from '../core/camera'
import { t } from '../i18n/phrases'

export default function CameraView({ cam, canvasRef, chip, chipTone = 'ok', overlay, compact }: {
  cam: Camera
  canvasRef?: RefObject<HTMLCanvasElement | null>
  chip?: string
  chipTone?: 'ok' | 'alert' | 'idle'
  overlay?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`camera ${compact ? 'compact' : ''}`}>
      <video ref={cam.videoRef} className={cam.mirrored ? 'mirrored' : undefined} autoPlay muted playsInline aria-label="Live camera preview" />
      {canvasRef && <canvas ref={canvasRef} className="camera-overlay" aria-hidden="true" />}
      {!cam.on && (
        <button type="button" className="camera-start" onClick={() => void cam.start()} disabled={cam.starting}>
          {cam.starting ? t('cameraStarting') : cam.error || t('cameraOff')}
        </button>
      )}
      {cam.on && chip && <div className={`camera-chip ${chipTone}`} aria-hidden="true"><i /><span>{chip}</span></div>}
      {overlay}
    </div>
  )
}
