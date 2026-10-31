// Live camera box with an optional drawing layer (obstacle boxes). Used by both modes.
import type { ReactNode, RefObject } from 'react'
import type { Camera } from '../core/camera'
import { t } from '../i18n/phrases'

export default function CameraView({ cam, canvasRef, badge, badgeAlert, overlay }: {
  cam: Camera
  canvasRef?: RefObject<HTMLCanvasElement | null>
  badge?: string
  badgeAlert?: boolean
  overlay?: ReactNode
}) {
  return (
    <div className="camera">
      <video ref={cam.videoRef} className={cam.mirrored ? 'mirrored' : undefined} autoPlay muted playsInline aria-label="Live camera preview" />
      {canvasRef && <canvas ref={canvasRef} className="camera-overlay" aria-hidden="true" />}
      {!cam.on && (
        <button type="button" className="camera-start" onClick={() => void cam.start()} disabled={cam.starting}>
          {cam.starting ? t('cameraStarting') : cam.error || t('cameraOff')}
        </button>
      )}
      {cam.on && badge && <div className={`camera-badge ${badgeAlert ? 'alert' : ''}`} aria-hidden="true">{badge}</div>}
      {overlay}
    </div>
  )
}
