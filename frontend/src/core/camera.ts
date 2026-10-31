// Rear camera: one shared stream for the whole app (preview + frame grabs).
let pending: Promise<MediaStream | null> | null = null;

export function getStream(): Promise<MediaStream | null> {
  if (!pending) {
    pending = navigator.mediaDevices?.getUserMedia
      ? navigator.mediaDevices
          .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
          .catch(() => null)
      : Promise.resolve(null);
  }
  return pending;
}
