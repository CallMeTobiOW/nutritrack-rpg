import { useState } from 'react';
import { Check, Pencil, Zap } from 'lucide-react';
import type { Quest } from '../../lib/models';
import { cn } from '../../lib/cn';
import { Icon } from '../../components/ui/Icon';

interface QuestRowProps {
  quest: Quest;
  done: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  /** e.g. "1.2 / 2.0 L" for auto-tracked quests. */
  autoProgress?: string;
  compact?: boolean;
}

export function QuestRow({ quest, done, onToggle, onEdit, autoProgress, compact }: QuestRowProps) {
  const [burst, setBurst] = useState(0);
  const auto = !!quest.auto;

  const handle = () => {
    if (auto || !onToggle) return;
    if (!done) setBurst((b) => b + 1);
    onToggle();
  };

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-2xl border px-3 transition-all duration-300',
        compact ? 'py-2.5' : 'py-3',
        done
          ? 'border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_7%,transparent)]'
          : 'border-line bg-surface-3/40',
      )}
    >
      <button
        type="button"
        onClick={handle}
        disabled={auto}
        aria-pressed={done}
        aria-label={auto ? `${quest.title} (tracked automatically)` : done ? `Mark "${quest.title}" as not done` : `Complete "${quest.title}"`}
        className={cn(
          'relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 transition-all duration-300',
          done ? 'border-success bg-success text-[#04140d] shadow-[0_0_16px_color-mix(in_srgb,var(--success)_60%,transparent)]' : 'border-line-strong text-muted',
          !auto && !done && 'hover:border-primary active:scale-90',
          auto && !done && 'border-dashed',
        )}
      >
        {done ? <Check size={20} strokeWidth={3} key={`c${burst}`} className="animate-pop" /> : <Icon name={quest.icon} size={17} />}
        {burst > 0 && done && (
          <span key={burst} className="pointer-events-none absolute inset-0" aria-hidden>
            <span className="absolute inset-0 rounded-xl border-2 border-success [animation:quest-ring_0.6s_ease-out_forwards]" />
            {Array.from({ length: 8 }).map((_, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-gold"
                style={{ ['--a' as string]: `${i * 45}deg`, animation: 'quest-spark 0.65s ease-out forwards' }}
              />
            ))}
          </span>
        )}
      </button>

      <button type="button" onClick={handle} disabled={auto} className="min-w-0 flex-1 text-left">
        <span className={cn('block font-medium leading-snug transition-colors', done && 'text-muted line-through decoration-success/60')}>{quest.title}</span>
        {(auto || autoProgress) && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-faint">
            <Zap size={12} className="text-primary" />
            {autoProgress ?? 'Tracked automatically'}
          </span>
        )}
      </button>

      <span className={cn('font-hud tabular shrink-0 text-sm font-bold', done ? 'text-gold' : 'text-faint')}>+{quest.xp}</span>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={`Edit "${quest.title}"`} className="-mr-1 grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-surface-3 hover:text-text">
          <Pencil size={15} />
        </button>
      )}
      {burst > 0 && done && (
        <span key={`xp${burst}`} className="font-hud pointer-events-none absolute right-10 top-1 text-sm font-bold text-gold [animation:xp-float_0.9s_ease-out_forwards]" aria-hidden>
          +{quest.xp} XP
        </span>
      )}
    </div>
  );
}
