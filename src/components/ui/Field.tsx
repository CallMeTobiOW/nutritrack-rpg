import { forwardRef, useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const inputBase =
  'h-12 w-full rounded-2xl border border-line bg-surface-3/70 px-4 text-[16px] text-text placeholder:text-faint outline-none transition focus:border-primary focus:bg-surface-2 focus:ring-2 focus:ring-primary/25';

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-medium text-muted">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-faint">{hint}</span>}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputBase, className)} {...rest} />;
});

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | undefined;
  onValue: (v: number | undefined) => void;
  suffix?: ReactNode;
  decimals?: boolean;
}

/**
 * Numeric input that keeps the raw text while typing (so "1." or "" are
 * allowed) and reports a parsed number, or undefined when blank. Accepts
 * a comma as the decimal separator for UK/EU keyboards.
 */
export function NumberInput({ value, onValue, suffix, decimals = true, className, ...rest }: NumberInputProps) {
  const [text, setText] = useState(value === undefined || Number.isNaN(value) ? '' : String(value));
  useEffect(() => {
    const parsed = parseNumber(text);
    if (parsed !== value) setText(value === undefined || Number.isNaN(value) ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        className={cn(inputBase, 'tabular', suffix ? 'pr-14' : '', className)}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,-]/g, '');
          setText(t);
          onValue(parseNumber(t));
        }}
        {...rest}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-faint">{suffix}</span>}
    </div>
  );
}

export function parseNumber(t: string): number | undefined {
  const s = t.trim().replace(',', '.');
  if (s === '' || s === '.' || s === '-') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(inputBase, 'appearance-none bg-[length:16px] pr-10', className)} {...rest}>
      {children}
    </select>
  );
});

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 py-2 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-surface-3 ring-1 ring-line-strong')}>
        <span className={cn('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}
