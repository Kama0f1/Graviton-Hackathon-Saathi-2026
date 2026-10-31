// Live rear-camera preview, dimmed behind the active half. Decorative for sighted helpers / judges.
import { useEffect, useRef } from 'react';
import { getStream } from '../core/camera';

export default function CameraView() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let alive = true;
    getStream().then((s) => {
      if (alive && s && ref.current) { ref.current.srcObject = s; ref.current.play().catch(() => {}); }
    });
    return () => { alive = false; };
  }, []);
  return <video ref={ref} className="cam" autoPlay playsInline muted aria-hidden="true" />;
}
