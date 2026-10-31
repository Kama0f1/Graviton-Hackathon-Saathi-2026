
import { useEffect, useRef, useState } from 'react'
import {
  detectObjects,
  loadDetectionModel,
} from '../vision/objectDetection'

type Language = 'en-IN' | 'hi-IN' | 'pa-IN'
type Position = 'left' | 'centre' | 'right'

export default function CameraView({
  language,
}: {
  language: Language
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Track previously announced objects.
  const lastAnnouncements = useRef<Map<string, number>>(new Map())

  // Track speech and vibration cooldowns.
  const lastSpeechTime = useRef(0)
  const lastVibrationTime = useRef(0)

  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [loading, setLoading] = useState(false)
  const [detectionStatus, setDetectionStatus] = useState('Detection is off')
  const [objectCount, setObjectCount] = useState(0)

  // -----------------------------------------
  // VOICE ANNOUNCEMENTS
  // -----------------------------------------

  const announceObject = (
    objectName: string,
    position: Position
  ) => {
    const now = Date.now()
    const key = `${objectName}-${position}`

    const previousTime = lastAnnouncements.current.get(key) || 0

    // Avoid repeating the same object within 6 seconds.
    if (now - previousTime < 6000) return

    // Avoid overlapping announcements.
    if (now - lastSpeechTime.current < 2500) return

    lastAnnouncements.current.set(key, now)
    lastSpeechTime.current = now

    const translations: Record<
      Language,
      (name: string, position: string) => string
    > = {
      'en-IN': (name, pos) => `${name} detected ${pos}.`,
      'hi-IN': (name, pos) => `${name} ${pos} दिखाई दे रहा है।`,
      'pa-IN': (name, pos) => `${name} ${pos} ਦਿਖਾਈ ਦੇ ਰਿਹਾ ਹੈ।`,
    }

    const positionTranslations: Record<
      Language,
      Record<Position, string>
    > = {
      'en-IN': {
        left: 'on your left',
        centre: 'in front of you',
        right: 'on your right',
      },
      'hi-IN': {
        left: 'आपकी बाईं ओर',
        centre: 'आपके सामने',
        right: 'आपकी दाईं ओर',
      },
      'pa-IN': {
        left: 'ਤੁਹਾਡੇ ਖੱਬੇ ਪਾਸੇ',
        centre: 'ਤੁਹਾਡੇ ਸਾਹਮਣੇ',
        right: 'ਤੁਹਾਡੇ ਸੱਜੇ ਪਾਸੇ',
      },
    }

    const translatedName: Record<
      Language,
      Record<string, string>
    > = {
      'en-IN': {},
      'hi-IN': {
        person: 'व्यक्ति',
        chair: 'कुर्सी',
        bottle: 'बोतल',
        car: 'कार',
        bicycle: 'साइकिल',
        dog: 'कुत्ता',
      },
      'pa-IN': {
        person: 'ਵਿਅਕਤੀ',
        chair: 'ਕੁਰਸੀ',
        bottle: 'ਬੋਤਲ',
        car: 'ਕਾਰ',
        bicycle: 'ਸਾਈਕਲ',
        dog: 'ਕੁੱਤਾ',
      },
    }

    const name = translatedName[language][objectName] || objectName
    const positionText = positionTranslations[language][position]
    const message = translations[language](name, positionText)

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message)
      utterance.lang = language
      utterance.rate = 0.9

      window.speechSynthesis.speak(utterance)
    }
  }

  // -----------------------------------------
  // VIBRATION FEEDBACK
  // -----------------------------------------

  const vibrateForObject = (bboxArea: number) => {
    if (!('vibrate' in navigator)) return

    const now = Date.now()

    // Prevent continuous vibration.
    if (now - lastVibrationTime.current < 2000) return

    if (bboxArea >= 0.35) {
      // Object occupies a large part of the frame.
      navigator.vibrate([200, 100, 200])
      lastVibrationTime.current = now
    } else if (bboxArea >= 0.15) {
      // Object occupies a moderately large part.
      navigator.vibrate(150)
      lastVibrationTime.current = now
    }
  }

  // -----------------------------------------
  // START CAMERA
  // -----------------------------------------

  const startCamera = async () => {
    setCameraError('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access requires HTTPS or localhost.')
      return
    }

    try {
      setLoading(true)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraOn(true)
    } catch (error) {
      console.error('Camera error:', error)

      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          setCameraError(
            'Camera permission denied. Allow camera access in your browser.'
          )
        } else if (error.name === 'NotFoundError') {
          setCameraError('No camera was found on this device.')
        } else {
          setCameraError(`Camera error: ${error.message}`)
        }
      } else {
        setCameraError('Unable to start the camera.')
      }
    } finally {
      setLoading(false)
    }
  }

  // -----------------------------------------
  // STOP CAMERA
  // -----------------------------------------

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height)
    }

    // Stop ongoing speech and vibration.
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    if ('vibrate' in navigator) {
      navigator.vibrate(0)
    }

    lastAnnouncements.current.clear()
    lastSpeechTime.current = 0
    lastVibrationTime.current = 0

    setCameraOn(false)
    setObjectCount(0)
    setDetectionStatus('Detection is off')
  }

  // -----------------------------------------
  // OBJECT DETECTION
  // -----------------------------------------

  useEffect(() => {
    if (!cameraOn) return

    let active = true
    let timeoutId: number | undefined

    const runDetection = async () => {
      const video = videoRef.current
      const canvas = canvasRef.current

      if (!active || !video || !canvas) return

      if (video.readyState < 2 || video.videoWidth === 0) {
        timeoutId = window.setTimeout(runDetection, 300)
        return
      }

      try {
        const predictions = await detectObjects(video)

        if (!active) return

        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        context.clearRect(0, 0, canvas.width, canvas.height)

        const visiblePredictions = predictions.filter(
          (prediction) => prediction.score >= 0.5
        )

        setObjectCount(visiblePredictions.length)

        visiblePredictions.forEach((prediction) => {
          const [x, y, width, height] = prediction.bbox

          // Determine approximate object position.
          const centerX = x + width / 2
          const frameCenter = video.videoWidth / 2

          let position: Position = 'centre'

          if (centerX < frameCenter * 0.75) {
            position = 'left'
          } else if (centerX > frameCenter * 1.25) {
            position = 'right'
          }

          // Announce objects with at least 65% confidence.
          if (prediction.score >= 0.65) {
            announceObject(prediction.class, position)
          }

          // Estimate the object's proportion of the camera frame.
          const objectArea =
            (width * height) /
            (video.videoWidth * video.videoHeight)

          // Trigger vibration based on apparent object size.
          if (prediction.score >= 0.65) {
            vibrateForObject(objectArea)
          }

          // Draw green bounding box.
          context.strokeStyle = '#00e676'
          context.lineWidth = 4
          context.strokeRect(x, y, width, height)

          // Draw object name and confidence.
          const label = `${prediction.class} ${Math.round(
            prediction.score * 100
          )}%`

          context.font = 'bold 18px Arial'

          const labelWidth = context.measureText(label).width + 16
          const labelHeight = 30
          const labelY = Math.max(0, y - labelHeight)

          context.fillStyle = '#00a85a'
          context.fillRect(x, labelY, labelWidth, labelHeight)

          context.fillStyle = '#ffffff'
          context.fillText(label, x + 8, labelY + 21)
        })

        setDetectionStatus('Object detection is active')
      } catch (error) {
        console.error('Detection error:', error)
        setDetectionStatus('Detection error. Check the console.')
      }

      if (active) {
        timeoutId = window.setTimeout(runDetection, 400)
      }
    }

    const initializeDetection = async () => {
      try {
        setDetectionStatus('Loading AI model...')

        await loadDetectionModel()

        if (active) {
          setDetectionStatus('AI model loaded. Detecting objects...')
          runDetection()
        }
      } catch (error) {
        console.error('Model loading error:', error)

        if (active) {
          setDetectionStatus('Could not load AI model. Check the console.')
        }
      }
    }

    initializeDetection()

    return () => {
      active = false

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [cameraOn, language])

  // -----------------------------------------
  // CLEANUP WHEN COMPONENT IS REMOVED
  // -----------------------------------------

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }

      if ('vibrate' in navigator) {
        navigator.vibrate(0)
      }
    }
  }, [])

  // -----------------------------------------
  // USER INTERFACE
  // -----------------------------------------

  return (
    <div className="camera-view">
      <div className="camera-preview">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Live camera preview"
        />

        <canvas
          ref={canvasRef}
          className="detection-canvas"
          aria-hidden="true"
        />

        {!cameraOn && (
          <div className="camera-placeholder">
            <span className="camera-placeholder-icon">📷</span>
            <p>Camera is currently off</p>
          </div>
        )}

        {cameraOn && (
          <div className="camera-live-indicator">
            <span />
            CAMERA LIVE
          </div>
        )}
      </div>

      {cameraError && (
        <p className="camera-error" role="alert">
          {cameraError}
        </p>
      )}

      <div className="detection-info" aria-live="polite">
        <p>{detectionStatus}</p>
        <p>Objects detected: {objectCount}</p>
      </div>

      <div className="camera-controls">
        {!cameraOn ? (
          <button
            type="button"
            onClick={startCamera}
            disabled={loading}
            className="camera-button"
          >
            {loading ? 'Starting camera...' : 'Start Camera'}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="camera-button camera-stop-button"
          >
            Stop Camera
          </button>
        )}
      </div>
    </div>
  )
}
