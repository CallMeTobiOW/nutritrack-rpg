import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ChevronsUp, Crown } from 'lucide-react';
import { ACHIEVEMENTS, TIER_COLORS } from '../../lib/achievements';
import { dismissCelebration, getCelebrations, subscribeCelebrations, type QueuedCelebration } from '../../lib/celebrations';
import { sfx } from '../../lib/sound';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';

/** Toasts for quests/achievements and a full-screen moment for level-ups. */
export function Celebrations() {
  const queue = useSyncExternalStore(subscribeCelebrations, getCelebrations, getCelebrations);
  const toasts = queue.filter((q) => q.item.kind !== 'level').slice(0, 3);
  const level = queue.find((q) => q.item.kind === 'level');

  return createPortal(
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {toasts.map((t) => (
          <Toast key={t.key} q={t} />
        ))}
      </div>
      {level && <LevelUp q={level} />}
    </>,
    document.body,
  );
}

function Toast({ q }: { q: QueuedCelebration }) {
  const { item } = q;
  useEffect(() => {
    if (item.kind === 'achievement') sfx.fanfare();
    else sfx.quest();
    const t = setTimeout(() => dismissCelebration(q.key), item.kind === 'achievement' ? 4200 : 2600);
    return () => clearTimeout(t);
  }, [q.key, item.kind]);

  if (item.kind === 'level') return null;
  const ach = item.kind === 'achievement' ? ACHIEVEMENTS.find((a) => a.id === item.id) : undefined;
  const color = ach ? TIER_COLORS[ach.tier] : item.kind === 'bonus' ? 'var(--gold)' : 'var(--success)';

  return (
    <button
      type="button"
      onClick={() => dismissCelebration(q.key)}
      className="animate-fade-up pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border bg-surface-2/95 px-4 py-3 text-left shadow-2xl backdrop-blur-xl"
      style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, boxShadow: `0 10px 40px -10px color-mix(in srgb, ${color} 50%, transparent)` }}
      role="status"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
        {ach ? <Icon name={ach.icon} size={22} /> : item.kind === 'bonus' ? <Crown size={22} /> : <CheckCircle2 size={22} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="hud-label block !text-[10px]" style={{ color }}>
          {item.kind === 'achievement' ? 'Achievement unlocked' : item.kind === 'bonus' ? 'Bonus reward' : 'Quest complete'}
        </span>
        <span className="block truncate font-semibold">{item.title}</span>
      </span>
      <span className="font-hud text-lg font-bold text-gradient-gold">+{item.xp} XP</span>
    </button>
  );
}

function LevelUp({ q }: { q: QueuedCelebration }) {
  useEffect(() => {
    sfx.fanfare();
  }, [q.key]);
  if (q.item.kind !== 'level') return null;
  return (
    <div className="animate-fade-in fixed inset-0 z-[70] grid place-items-center bg-[var(--backdrop)] p-6 backdrop-blur-md" role="dialog" aria-label="Level up">
      <div className="panel hud-corners animate-pop w-full max-w-sm overflow-hidden p-8 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--gold)_25%,transparent),transparent_65%)]" />
        <ChevronsUp className="mx-auto text-gold drop-shadow-[0_0_14px_var(--gold)]" size={44} />
        <p className="hud-label mt-3 !text-gold">Level up</p>
        <p className="font-hud text-gradient-gold mt-1 text-7xl font-bold leading-none">{q.item.level}</p>
        <p className="font-hud mt-2 text-2xl font-semibold tracking-wide">{q.item.title}</p>
        <p className="mt-3 text-sm text-muted">Every level is a record of days you showed up. Keep going.</p>
        <Button variant="gold" block className="mt-6" onClick={() => dismissCelebration(q.key)}>
          Continue
        </Button>
      </div>
    </div>
  );
}
