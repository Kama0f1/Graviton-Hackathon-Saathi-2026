// Rear camera as a React hook: start/stop, plus grab() -> compressed JPEG of the current frame.
import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../i18n/phrases'

export type Camera = ReturnType<typeof useCamera>

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pending = useRef<Promise<boolean> | null>(null) // one start at a time (React dev mounts twice)
  const [on, setOn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  // front / laptop camera: the picture is shown like a mirror, and left/right are flipped for speech
  const [mirrored, setMirrored] = useState(false)

  const start = useCallback((): Promise<boolean> => {
    if (streamRef.current) {
      const v = videoRef.current
      if (v && v.srcObject !== streamRef.current) { v.srcObject = streamRef.current; void v.play().catch(() => undefined) }
      return Promise.resolve(true)
    }
    pending.current ??= open().finally(() => { pending.current = null })
    return pending.current
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (): Promise<boolean> => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) { setError(t('cameraNeedsHttps')); return false }
    setStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      const facing = stream.getVideoTracks()[0]?.getSettings().facingMode
      const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
      setMirrored(facing === 'user' || (!facing && !mobile))
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setOn(true)
      return true
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setError(name === 'NotAllowedError' ? t('cameraDenied') : name === 'NotFoundError' ? t('noCamera') : t('error'))
      return false
    } finally {
      setStarting(false)
    }
  }

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setOn(false)
  }, [])

  // Current frame as a JPEG, longest side <= maxSide (small uploads = faster answers).
  const grab = useCallback(async (maxSide = 1280, quality = 0.85): Promise<Blob | null> => {
    const v = videoRef.current
    if (!v || v.readyState < 2 || !v.videoWidth) return null
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * scale)
    c.height = Math.round(v.videoHeight * scale)
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height)
    return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', quality))
  }, [])

  useEffect(() => () => { streamRef.current?.getTracks().forEach((tr) => tr.stop()) }, [])

  return { videoRef, on, starting, error, mirrored, start, stop, grab }
}
