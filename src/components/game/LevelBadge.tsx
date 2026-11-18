import { useId } from 'react';

/** Hexagonal level insignia. */
export function LevelBadge({ level, size = 64 }: { level: number; size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-label={`Level ${level}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0 drop-shadow-[0_0_10px_color-mix(in_srgb,var(--gold)_45%,transparent)]">
        <defs>
          <linearGradient id={`lb-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--gold)" />
            <stop offset="1" stopColor="var(--orange)" />
          </linearGradient>
          <linearGradient id={`lbf-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--surface-3)" />
            <stop offset="1" stopColor="var(--surface-2)" />
          </linearGradient>
        </defs>
        <polygon points="50,4 92,28 92,72 50,96 8,72 8,28" fill={`url(#lbf-${id})`} stroke={`url(#lb-${id})`} strokeWidth="5" strokeLinejoin="round" />
      </svg>
      <div className="relative text-center leading-none">
        <div className="font-hud text-[9px] font-bold tracking-[0.2em] text-muted" style={{ fontSize: size * 0.13 }}>
          LVL
        </div>
        <div className="font-hud text-gradient-gold font-bold tabular" style={{ fontSize: size * 0.38 }}>
          {level}
        </div>
      </div>
    </div>
  );
}
