import type { ReactNode } from 'react';

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

/** Shared tooltip card for Recharts (pass rows from the chart's payload). */
export function TooltipCard({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="min-w-[9rem] rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold text-text">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1.5 text-muted">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="tabular font-semibold text-text">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export const AXIS_TICK = { fill: 'var(--faint)', fontSize: 11 };
export const GRID_STROKE = 'var(--line)';

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? (
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
          ) : (
            <span className="h-2 w-3 rounded-sm" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}
