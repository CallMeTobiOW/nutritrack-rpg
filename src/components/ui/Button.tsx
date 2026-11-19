import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    // #0369a1 → #2563eb keeps white text at ≥ 5:1 across the whole gradient.
    'text-white bg-gradient-to-br from-[#0369a1] to-[#2563eb] shadow-glow ring-1 ring-inset ring-white/15 hover:brightness-110 active:brightness-95',
  // Fill tokens stay bright in both themes so the dark label keeps its contrast.
  gold: 'text-[#1a1203] bg-gradient-to-br from-[var(--gold-fill)] to-[var(--orange-fill)] shadow-glow-gold hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-3 text-text border border-line hover:border-line-strong active:bg-surface-2',
  ghost: 'text-muted hover:text-text hover:bg-surface-3/60',
  danger: 'text-white bg-danger hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-2xl gap-2',
  lg: 'h-13 px-5 text-base rounded-2xl gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    />
  );
});

export function IconButton({ className, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-3 hover:text-text active:scale-95 disabled:opacity-40',
        className,
      )}
      {...rest}
    />
  );
}
