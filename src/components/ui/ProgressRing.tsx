import { useId, type ReactNode } from 'react';

interface ProgressRingProps {
  /** 0..1+ (values above 1 show a full ring plus an overflow arc). */
  value: number;
  size?: number;
  stroke?: number;
  from?: string;
  to?: string;
  track?: string;
  children?: ReactNode;
  label?: string;
  glow?: boolean;
}

/** Circular progress with a gradient stroke and soft glow. */
export function ProgressRing({
  value,
  size = 168,
  stroke = 14,
  from = 'var(--gold)',
  to = 'var(--orange)',
  track = 'var(--surface-3)',
  children,
  label,
  glow = true,
}: ProgressRingProps) {
  const id = useId().replace(/:/g, '');
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const over = Math.max(0, Math.min(1, value - 1));

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          {glow && (
            <filter id={`f-${id}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#g-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          filter={glow ? `url(#f-${id})` : undefined}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
        {over > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--danger)"
            strokeOpacity={0.85}
            strokeWidth={stroke * 0.45}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - over)}
            style={{ transition: 'stroke-dashoffset 0.9s ease' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
