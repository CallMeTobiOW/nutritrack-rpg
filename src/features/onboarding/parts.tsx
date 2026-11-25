import { useRef, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, Minus, Plus, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { parseNumber } from '../../components/ui/Field';
import { NudgeButton } from '../../components/ui/RulerPicker';
import { SpeakerEmblem } from '../briefing/SpeakerEmblem';
import { SPEAKERS } from '../../data/briefings';

/** Back button and segmented progress for the question screens. */
export function OnboardingHeader({ onBack, current, total }: { onBack: () => void; current: number; total: number }) {
  return (
    <header className="mx-auto flex w-full max-w-lg items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-3 hover:text-text active:scale-95"
      >
        <ChevronLeft size={26} />
      </button>
      <div
        className="flex flex-1 gap-1"
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={current}
      >
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <span
              className="block h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
              style={{ width: i < current ? '100%' : '0%' }}
            />
          </span>
        ))}
      </div>
      <span className="font-hud tabular w-11 shrink-0 text-center text-sm font-semibold text-muted">
        {Math.min(current, total)}/{total}
      </span>
    </header>
  );
}

/** One question per screen, asked by the player's guide. */
export function Question({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  const guide = SPEAKERS.mentor;
  return (
    <div className="flex flex-1 flex-col pt-3">
      <div className="flex items-center gap-2.5">
        <SpeakerEmblem category="mentor" size={30} />
        <span className="hud-label" style={{ color: guide.accent }}>
          {guide.name}
        </span>
      </div>
      <h1 className="ob-display mt-4 text-[2.4rem] text-text">{title}</h1>
      {sub && <p className="mt-3 text-[15px] leading-relaxed text-muted">{sub}</p>}
      <div className="mt-7 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** Large tappable option with an icon, used in single-choice questions. */
export function OptionCard({
  icon: Icon,
  title,
  hint,
  active,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'group flex w-full items-center gap-4 rounded-3xl border p-3.5 pr-4 text-left transition-all duration-200 active:scale-[0.985]',
        active ? 'border-gold/70 bg-gold/10 shadow-glow-gold' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span
        className={cn(
          'grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors',
          active ? 'bg-[var(--gold-fill)] text-[#1a1203]' : 'bg-surface-3 text-muted group-hover:text-text',
        )}
      >
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold leading-snug">{title}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </span>
      <span
        className={cn(
          'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors',
          active ? 'border-[var(--gold-fill)] bg-[var(--gold-fill)] text-[#1a1203]' : 'border-line-strong',
        )}
      >
        {active && <Check size={14} strokeWidth={3.5} />}
      </span>
    </button>
  );
}

export function OptionList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="space-y-2.5">
      {children}
    </div>
  );
}

/**
 * Big read-out with step buttons either side and a ruler underneath. The
 * read-out is dimmed until the player has set the value themselves.
 */
export function MeasureControl({
  readout,
  ruler,
  onMinus,
  onPlus,
  hint,
  set,
  footer,
}: {
  readout: ReactNode;
  ruler: ReactNode;
  onMinus: () => void;
  onPlus: () => void;
  hint: string;
  set: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center pb-4">
      <div className="flex items-center justify-between gap-2">
        <NudgeButton label="Decrease" onNudge={onMinus}>
          <Minus size={22} />
        </NudgeButton>
        <div className={cn('min-w-0 flex-1 text-center transition-opacity duration-300', !set && 'opacity-50')}>{readout}</div>
        <NudgeButton label="Increase" onNudge={onPlus}>
          <Plus size={22} />
        </NudgeButton>
      </div>
      <div className="-mx-6 mt-8">{ruler}</div>
      <p className="mt-2 text-center text-sm text-faint">{hint}</p>
      {footer && <div className="mt-6 flex justify-center">{footer}</div>}
    </div>
  );
}

const readoutNumber = 'font-hud tabular font-bold leading-none tracking-tight text-text';
/** Long values (e.g. "164.7") step down a size so the unit never hits the step buttons at 375px. */
const readoutSize = (chars: number) => (chars >= 5 ? 'text-[3.4rem]' : chars === 4 ? 'text-[3.9rem]' : 'text-[4.5rem]');

/**
 * Editable big number. Shows the formatted value; tap it to type an exact
 * one. Commits on Enter or blur, and the parent clamps it to range.
 */
export function NumberReadout({
  display,
  unit,
  label,
  decimals,
  onCommit,
}: {
  display: string;
  unit: string;
  label: string;
  decimals: boolean;
  onCommit: (n: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(display);
  const cancelled = useRef(false);
  const text = editing ? draft : display;

  const commit = () => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const n = parseNumber(draft);
    if (n !== undefined) onCommit(n);
  };

  return (
    <label className="inline-flex cursor-text items-baseline justify-center">
      <span className="sr-only">{label}</span>
      <input
        type="text"
        inputMode={decimals ? 'decimal' : 'numeric'}
        autoComplete="off"
        enterKeyHint="done"
        value={text}
        onFocus={(e) => {
          setDraft(display);
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        className={cn(
          readoutNumber,
          readoutSize(display.length),
          'rounded-xl border-0 bg-transparent p-0 text-center outline-none focus-visible:outline-none focus:bg-surface-3/60',
        )}
        style={{ width: `${Math.max(2, text.length) + 0.25}ch` }}
      />
      <span className="font-hud ml-1.5 text-2xl font-semibold text-muted">{unit}</span>
    </label>
  );
}

/** Non-editable read-out, for feet and inches. */
export function StaticReadout({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" className={cn(readoutNumber, readoutSize(3))}>
      {children}
    </div>
  );
}
