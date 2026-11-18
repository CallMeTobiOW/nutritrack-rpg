import { cn } from '../../lib/cn';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  size?: 'sm' | 'md';
  label?: string;
}

export function Segmented<T extends string>({ value, onChange, options, className, size = 'md', label }: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex rounded-2xl border border-line bg-surface-3/70 p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-xl font-hud font-semibold uppercase tracking-wider transition-all',
              size === 'sm' ? 'h-8 text-[12px]' : 'h-9 text-[13px]',
              active ? 'bg-surface-2 text-text shadow-card ring-1 ring-line-strong' : 'text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
