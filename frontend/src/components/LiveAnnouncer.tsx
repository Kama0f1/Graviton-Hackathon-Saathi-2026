// aria-live region so screen readers announce status updates.
export default function LiveAnnouncer() {
  return <div aria-live="polite" className="sr-only" id="announcer" />;
}
