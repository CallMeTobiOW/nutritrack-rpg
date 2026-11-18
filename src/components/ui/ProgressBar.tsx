import { cn } from '../../lib/cn';

interface ProgressBarProps {
  value: number; // 0..1+
  color?: string;
  to?: string;
  height?: number;
  className?: string;
  /** For limits (sugar, sodium…): turn amber near the limit and red above it. */
  limit?: boolean;
  label?: string;
}

export function ProgressBar({ value, color = 'var(--primary)', to, height = 8, className, limit, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  let fill = to ? `linear-gradient(90deg, ${color}, ${to})` : color;
  if (limit && value > 1) fill = 'var(--danger)';
  else if (limit && value > 0.85) fill = 'var(--orange)';
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-full bg-surface-3', className)}
      style={{ height }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: fill,
          boxShadow: `0 0 10px color-mix(in srgb, ${limit && value > 1 ? 'var(--danger)' : color} 45%, transparent)`,
          transition: 'width 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      />
    </div>
  );
}
