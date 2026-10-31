// Simple line icons. Always paired with a word; never meaning by colour alone.
const paths = {
  navigate: 'M12 2 4 21l8-4 8 4z',
  read: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h8',
  check: 'M20 6 9 17l-5-5',
  spinner: 'M21 12a9 9 0 1 1-6.2-8.56',
  wave: 'M3 10v4M7 7v10M11 4v16M15 8v8M19 10v4',
  mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v4',
  offline: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 5-2.7M14 9.8a10 10 0 0 1 5 2.7M2 8.8a15 15 0 0 1 4.2-2.6M12 20h.01',
  warning: 'M12 3 2 21h20zM12 10v5M12 18h.01',
} as const;

export type IconName = keyof typeof paths;

export default function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
