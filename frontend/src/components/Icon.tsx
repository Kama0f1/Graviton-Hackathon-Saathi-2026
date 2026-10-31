// Line icons (24 px grid, drawn with currentColor). Always decorative: the button next to them has words.
const P: Record<string, string> = {
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  nav: '<path d="M4 11l16-7-7 16-2-7-7-2z" stroke-linejoin="round"/>',
  read: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  say: '<path d="M4 5h16v11H9l-5 4V5z" stroke-linejoin="round"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  warn: '<path d="M12 4l9 16H3z" stroke-linejoin="round"/><path d="M12 10v4M12 17.5h.01"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  repeat: '<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" stroke-linejoin="round"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5" fill="currentColor" stroke="none"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  sign: '<rect x="3" y="4" width="18" height="11" rx="2"/><path d="M12 15v6"/>',
  bin: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke-linejoin="round"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/>',
  photo: '<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8.5 6l1.5-2h4l1.5 2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  send: '<path d="M5 12h14M13 6l6 6-6 6" stroke-linejoin="round"/>',
  more: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" stroke-linejoin="round"/>',
  turnRight: '<path d="M14 15l5-5-5-5M5 20v-6a4 4 0 0 1 4-4h10" stroke-linejoin="round"/>',
  turnLeft: '<path d="M10 15l-5-5 5-5M19 20v-6a4 4 0 0 0-4-4H5" stroke-linejoin="round"/>',
  straight: '<path d="M12 20V4M6 10l6-6 6 6" stroke-linejoin="round"/>',
  uturn: '<path d="M9 20V9a5 5 0 0 1 10 0v3M5 16l4 4 4-4" stroke-linejoin="round"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
}
export type IconName = keyof typeof P

export default function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1}
      strokeLinecap="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: P[name] }} />
  )
}
