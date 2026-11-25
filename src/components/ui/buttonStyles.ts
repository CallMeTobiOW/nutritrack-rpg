import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    // #0369a1 → #2563eb keeps white text at ≥ 5:1 across the whole gradient.
    'text-white bg-gradient-to-br from-[#0369a1] to-[#2563eb] shadow-glow ring-1 ring-inset ring-white/15 hover:brightness-110 active:brightness-95',
  // Fill tokens stay bright in both themes so the dark label keeps its contrast.
  gold: 'text-[#1a1203] bg-gradient-to-br from-[var(--gold-fill)] to-[var(--orange-fill)] shadow-glow-gold hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-3 text-text border border-line hover:border-line-strong active:bg-surface-2',
  ghost: 'text-muted hover:text-text hover:bg-surface-3/60',
  danger: 'text-white bg-danger hover:brightness-110',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl gap-1.5 font-semibold',
  md: 'h-11 px-4 text-[15px] rounded-2xl gap-2 font-semibold',
  lg: 'h-13 px-5 text-base rounded-2xl gap-2 font-semibold',
  /** Full pill for a screen's single main action (onboarding). */
  xl: 'h-14 px-6 text-[17px] rounded-full gap-2 font-bold',
};

/** Button styling for elements that must not be a <button>, such as a link. */
export function buttonClass({ variant = 'secondary', size = 'md', block }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean } = {}): string {
  return cn(
    'inline-flex select-none items-center justify-center transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
  );
}
