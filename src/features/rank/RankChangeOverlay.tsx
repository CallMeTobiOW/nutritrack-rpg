import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { updateSettings } from '../../db/actions';
import { useRank } from '../../hooks/useData';
import type { DateKey } from '../../lib/dates';
import { rankFromRating, seenStep } from '../../lib/rank';
import { sfx } from '../../lib/sound';
import { Button } from '../../components/ui/Button';
import { RankEmblem, tierColor, tierTextColor } from '../../components/game/RankEmblem';

const COPY = {
  placed: { kicker: 'Placements complete', line: 'The ladder has measured you. Now climb it.' },
  promoted: { kicker: 'Rank up', line: 'Your days earned this. Hold the line.' },
  demoted: { kicker: 'Rank down', line: 'A setback, not a verdict. Win back the ground tomorrow.' },
} as const;

/**
 * Shows a rank change once. Matches lock at day change, often while the app
 * is closed, so the last rank the player saw is stored rather than relying
 * on an in-memory celebration. Waits for the daily briefing to be dismissed.
 */
export function RankChangeGate({ today }: { today: DateKey }) {
  const rank = useRank(today);
  const briefing = useLiveQuery(async () => (await db.briefings.get(today)) ?? null, [today]);
  if (!rank || rank.seenStep === undefined || briefing === undefined || briefing?.acknowledged === false) return null;
  const state = rank.locked.state;
  const step = seenStep(state);
  if (step === rank.seenStep) return null;
  const kind = rank.seenStep === -1 ? 'placed' : step > rank.seenStep ? 'promoted' : step === -1 ? null : 'demoted';
  if (!kind) return null;
  return <RankChange kind={kind} rating={state.rating} onDone={() => void updateSettings({ rankSeenStep: step })} />;
}

function RankChange({ kind, rating, onDone }: { kind: keyof typeof COPY; rating: number; onDone: () => void }) {
  const r = rankFromRating(rating);
  const color = tierColor(r.tier.id);
  useEffect(() => {
    if (kind !== 'demoted') sfx.fanfare();
  }, [kind]);

  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-[70] grid place-items-center bg-[var(--backdrop)] p-6 backdrop-blur-md" role="dialog" aria-label={COPY[kind].kicker}>
      <div className="panel hud-corners animate-pop relative w-full max-w-sm overflow-hidden p-8 text-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(circle at 50% 10%, color-mix(in srgb, ${color} ${kind === 'demoted' ? 12 : 30}%, transparent), transparent 65%)` }}
        />
        <p className="hud-label relative" style={{ color: kind === 'demoted' ? 'var(--muted)' : tierTextColor(r.tier.id) }}>
          {COPY[kind].kicker}
        </p>
        <RankEmblem tier={r.tier.id} division={r.division} size={128} className="relative mx-auto mt-3" />
        <p className="font-hud relative mt-2 text-4xl font-bold leading-none" style={{ color: tierTextColor(r.tier.id) }}>
          {r.label}
        </p>
        <p className="relative mt-3 text-sm text-muted">{COPY[kind].line}</p>
        <Button variant={kind === 'demoted' ? 'secondary' : 'gold'} block className="relative mt-6" onClick={onDone}>
          Continue
        </Button>
      </div>
    </div>,
    document.body,
  );
}
