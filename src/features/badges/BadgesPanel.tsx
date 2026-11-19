import { useMemo, useState } from 'react';
import { Check, ChevronUp, Info } from 'lucide-react';
import { useBadges } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { MAX_STEP, stepLabel, stepOf, winsToNextStep, type BadgeStanding } from '../../lib/badges';
import { expectedScore, rankFromRating } from '../../lib/rank';
import { cn } from '../../lib/cn';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Misc';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Sheet } from '../../components/ui/Sheet';
import { RankEmblem, tierColor, tierTextColor } from '../../components/game/RankEmblem';

/** The badge crest: the rank emblem for the badge's current standing, with the badge's own symbol. */
export function BadgeCrest({ b, size = 52, className }: { b: BadgeStanding; size?: number; className?: string }) {
  return (
    <RankEmblem
      tier={b.rank.tier.id}
      division={b.claimed ? b.rank.division : null}
      unranked={!b.claimed}
      glyph={b.def.icon}
      size={size}
      label={b.claimed ? `${b.def.title}: ${b.rank.label}` : `${b.def.title}: not yet claimed`}
      className={className}
    />
  );
}

/** Badges tab: every badge on its own ladder, with lifetime peaks. */
export function BadgesPanel() {
  const today = useToday();
  const data = useBadges(today);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data?.standings.find((b) => b.def.id === openId) ?? null;

  const summary = useMemo(() => {
    if (!data) return null;
    const claimed = data.standings.filter((b) => b.claimed);
    const best = [...claimed].sort((a, b) => b.locked.rating - a.locked.rating)[0];
    return { claimed: claimed.length, best };
  }, [data]);

  if (!data || !summary) return null;

  return (
    <div>
      <Card className="mb-4">
        <div className="flex items-baseline justify-between">
          <span className="hud-label">Claimed</span>
          <span className="font-hud tabular text-2xl font-bold">
            {summary.claimed}
            <span className="text-base text-muted">/{data.standings.length}</span>
          </span>
        </div>
        {summary.best && (
          <p className="mt-1 text-sm text-muted">
            Highest: <span className="font-semibold" style={{ color: tierTextColor(summary.best.rank.tier.id) }}>{summary.best.def.title} {summary.best.rank.label}</span>
          </p>
        )}
        <p className="mt-2 text-xs text-faint">
          Each badge climbs the rank ladder on its own goal. Hit it to climb, miss it and it slips. The higher the tier, the more days it takes to hold.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {data.standings.map((b) => (
          <BadgeTile key={b.def.id} b={b} onOpen={() => setOpenId(b.def.id)} />
        ))}
      </div>

      <p className="mt-4 flex gap-2 px-1 text-xs text-faint">
        <Info size={14} className="mt-0.5 shrink-0" />
        Days count once they lock, at the end of the following day, so editing old days can't change a badge. A day with nothing logged counts as a miss.
      </p>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.def.title}>
        {open && <BadgeDetail b={open} />}
      </Sheet>
    </div>
  );
}

function BadgeTile({ b, onOpen }: { b: BadgeStanding; onOpen: () => void }) {
  const color = tierColor(b.rank.tier.id);
  const peakAbove = b.claimed && stepOf(b.locked.peak) > stepOf(b.locked.rating);
  const zenith = b.rank.division === null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('panel flex flex-col items-center px-3 pb-3 pt-4 text-center transition active:scale-[0.98]')}
      style={b.claimed ? { borderColor: `color-mix(in srgb, ${color} 35%, transparent)`, boxShadow: `0 0 24px -12px ${color}` } : undefined}
    >
      <BadgeCrest b={b} />
      <span className={cn('mt-2 text-sm font-semibold leading-tight', !b.claimed && 'text-muted')}>{b.def.title}</span>
      {b.claimed ? (
        <span className="font-hud mt-0.5 text-base font-bold leading-tight" style={{ color: tierTextColor(b.rank.tier.id) }}>
          {b.rank.label}
        </span>
      ) : (
        <span className="mt-0.5 text-xs text-faint">Not yet claimed</span>
      )}
      <div className="mt-2 w-full">
        <ProgressBar value={b.claimed ? (zenith ? 1 : b.rank.progress / 100) : 0} color={color} height={4} label={`${b.def.title} progress`} />
      </div>
      <span className="mt-1.5 flex h-4 items-center gap-1 text-[11px] text-faint">
        {peakAbove ? (
          <>
            <ChevronUp size={12} /> Peak {b.peakRank.label}
          </>
        ) : b.hitToday ? (
          <span className="flex items-center gap-1 text-success">
            <Check size={12} /> Hit today
          </span>
        ) : (
          'Not hit today yet'
        )}
      </span>
    </button>
  );
}

function BadgeDetail({ b }: { b: BadgeStanding }) {
  const step = stepOf(b.locked.rating);
  const projectedStep = stepOf(b.projected.rating);
  const holdPct = Math.round(expectedScore(b.locked.rating) * 100);
  const wins = winsToNextStep(b.locked.rating);
  const hitRate = b.locked.days ? Math.round((b.locked.hits / b.locked.days) * 100) : 0;
  const projected = rankFromRating(b.projected.rating);

  return (
    <div className="flex flex-col items-center pb-4 pt-1 text-center">
      <BadgeCrest b={b} size={104} />
      {b.claimed ? (
        <p className="font-hud mt-2 text-3xl font-bold leading-none" style={{ color: tierTextColor(b.rank.tier.id) }}>
          {b.rank.label}
        </p>
      ) : (
        <p className="font-hud mt-2 text-2xl font-bold leading-none text-muted">Not yet claimed</p>
      )}
      {b.claimed && (
        <Chip color={tierColor(b.peakRank.tier.id)} className="mt-2">
          Lifetime peak {b.peakRank.label}
        </Chip>
      )}

      <p className="mt-3 font-semibold">{b.def.goal}</p>
      <p className="mt-0.5 text-sm italic text-muted">{b.def.lore}</p>

      <div className="mt-4 grid w-full grid-cols-3 gap-2">
        <DetailStat label="Hit rate" value={b.locked.days ? `${hitRate}%` : '–'} sub={`${b.locked.hits} of ${b.locked.days} days`} />
        <DetailStat label="Run" value={`${b.locked.run}d`} sub="in a row" />
        <DetailStat label="Best run" value={`${b.locked.bestRun}d`} sub="lifetime" />
      </div>

      <ul className="mt-4 w-full space-y-2 text-left text-sm">
        <li className="rounded-xl bg-surface-3/50 px-3 py-2.5">
          {step >= MAX_STEP ? (
            <>The summit. Hit your goal on {holdPct}% of days or more to hold it.</>
          ) : !b.claimed ? (
            <>Hit this goal on a day and it's claimed at Bronze 5 once that day locks.</>
          ) : (
            <>
              <span className="font-semibold">{stepLabel(step + 1)}</span> in {wins} more {wins === 1 ? 'win' : 'wins'} in a row. To hold your tier, hit the goal on about {holdPct}% of days.
            </>
          )}
        </li>
        {projectedStep !== step && b.projected.days > b.locked.days && (
          <li className="rounded-xl bg-surface-3/50 px-3 py-2.5">
            If yesterday and today lock as they stand: <span className="font-semibold" style={{ color: tierTextColor(projected.tier.id) }}>{projected.label}</span>.
          </li>
        )}
        <li className="rounded-xl bg-surface-3/50 px-3 py-2.5">
          {b.hitToday ? (
            <span className="text-success">Today's goal is hit. It counts when the day locks.</span>
          ) : (
            <>Today's goal isn't hit yet.</>
          )}
        </li>
      </ul>
      <p className="mt-3 text-xs text-faint">Each new division pays XP the first time you reach it, more in higher tiers.</p>
    </div>
  );
}

function DetailStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-3/50 px-1 py-2">
      <div className="font-hud tabular text-xl font-bold leading-tight">{value}</div>
      <div className="hud-label !text-[9px]">{label}</div>
      <div className="text-[10px] text-faint">{sub}</div>
    </div>
  );
}
