// Live camera card that fills the free space. Cards float on it: `top` (route, answer) and `bottom` (hazard),
// plus a status chip. Used by both modes.
import type { ReactNode, RefObject } from 'react'
import type { Camera } from '../core/camera'
import { t } from '../i18n/phrases'

export default function CameraView({ cam, canvasRef, chip, chipTone = 'ok', overlay, top, bottom }: {
  cam: Camera
  canvasRef?: RefObject<HTMLCanvasElement | null>
  chip?: string
  chipTone?: 'ok' | 'alert' | 'idle'
  overlay?: ReactNode   // full-size layer (scan frame)
  top?: ReactNode
  bottom?: ReactNode
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
      {overlay}
      <div className="cam-layer">
        {top}
        <div className="cam-spacer" />
        {bottom}
        {cam.on && chip && <div className={`camera-chip ${chipTone}`} aria-hidden="true"><i /><span>{chip}</span></div>}
      </div>
    </div>
  )
}
