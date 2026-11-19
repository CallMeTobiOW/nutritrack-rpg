import { Check, Lock, Shield, Swords, X } from 'lucide-react';
import { useRank } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { formatLongDate, formatShortDate, formatWeekday } from '../../lib/dates';
import {
  PLACEMENT_MATCHES,
  SCORE_LABELS,
  SCORE_WEIGHTS,
  TIERS,
  breakEvenScore,
  rankFromRating,
  type MatchOutcome,
  type RankState,
  type ScoredGoal,
} from '../../lib/rank';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { Chip, PageHeader } from '../../components/ui/Misc';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { RankEmblem, tierColor, tierTextColor } from '../../components/game/RankEmblem';

export default function RankPage() {
  const today = useToday();
  const rank = useRank(today);

  return (
    <Page>
      <PageHeader back="/profile" kicker="Competitive" title="Rank" />
      {!rank ? (
        <Card className="h-72" />
      ) : (
        <div className="space-y-4">
          <StandingCard state={rank.locked.state} />
          {[...rank.pending].reverse().map((o) => (
            <LiveMatchCard key={o.date} outcome={o} today={today} lockedState={rank.locked.state} />
          ))}
          <HistoryCard outcomes={rank.locked.outcomes} />
          <LadderCard state={rank.locked.state} />
          <RulesCard seasonStart={rank.seasonStart} />
        </div>
      )}
    </Page>
  );
}

function StandingCard({ state }: { state: RankState }) {
  if (!state.placed) {
    return (
      <Card hud className="animate-fade-up overflow-hidden text-center">
        <RankEmblem tier="bronze" unranked size={104} className="mx-auto" />
        <p className="font-hud mt-2 text-2xl font-bold">Placements</p>
        <p className="mt-1 text-sm text-muted">
          Your rank is revealed after {PLACEMENT_MATCHES} matches. Each day you play counts. Show the ladder what you're made of.
        </p>
        <div className="mx-auto mt-4 flex max-w-[16rem] justify-center gap-2" aria-label={`${state.placementsPlayed} of ${PLACEMENT_MATCHES} placement matches played`}>
          {Array.from({ length: PLACEMENT_MATCHES }, (_, i) => (
            <span key={i} className={`h-2.5 flex-1 rounded-full ${i < state.placementsPlayed ? 'bg-primary shadow-glow' : 'bg-surface-3'}`} />
          ))}
        </div>
        <p className="hud-label mt-2 !text-[10px]">
          {state.placementsPlayed} / {PLACEMENT_MATCHES} played
        </p>
      </Card>
    );
  }

  const r = rankFromRating(state.rating);
  const color = tierColor(r.tier.id);
  const next = r.division === null ? null : rankFromRating(state.rating - r.progress + 100);
  const record = state.wins + state.losses;

  return (
    <Card hud className="animate-fade-up overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 0%, color-mix(in srgb, ${color} 22%, transparent), transparent 65%)` }}
      />
      <div className="relative text-center">
        <RankEmblem tier={r.tier.id} division={r.division} size={112} className="mx-auto" />
        <p className="font-hud mt-2 text-[34px] font-bold leading-none" style={{ color: tierTextColor(r.tier.id) }}>
          {r.label}
        </p>
        <p className="mt-1.5 text-sm text-muted">{r.tier.motto}</p>
        {state.shield > 0 && (
          <div className="mt-2 flex justify-center">
            <Chip color="var(--primary)">
              <Shield size={12} /> Tier shield · {state.shield} match{state.shield === 1 ? '' : 'es'}
            </Chip>
          </div>
        )}
      </div>
      <div className="relative mt-4">
        {next ? (
          <>
            <ProgressBar value={r.progress / 100} color={color} height={10} label={`Progress to ${next.label}`} />
            <div className="mt-1.5 flex justify-between text-xs text-muted tabular">
              <span>{r.progress} / 100 RP</span>
              <span>{100 - r.progress} RP to {next.label}</span>
            </div>
          </>
        ) : (
          <p className="text-center text-sm font-semibold tabular" style={{ color: tierTextColor('zenith') }}>
            {r.progress.toLocaleString()} RP above the summit
          </p>
        )}
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="Rating" value={state.rating.toLocaleString()} />
        <MiniStat label="Peak" value={rankFromRating(state.peak).label} />
        <MiniStat label="Record" value={record ? `${state.wins}–${state.losses}` : '–'} sub={state.run >= 3 ? `${state.run} win run` : state.run <= -3 ? `${-state.run} losses` : undefined} />
      </div>
    </Card>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-3/40 px-1 py-2">
      <div className="font-hud tabular truncate text-lg font-bold leading-tight">{value}</div>
      <div className="hud-label !text-[9px]">{label}</div>
      {sub && <div className="text-[10px] text-faint">{sub}</div>}
    </div>
  );
}

function LiveMatchCard({ outcome, today, lockedState }: { outcome: MatchOutcome; today: string; lockedState: RankState }) {
  const isToday = outcome.date === today;
  const hit = new Set<ScoredGoal>(outcome.goals);
  const placement = outcome.result === 'placement';
  const deltaColor = outcome.delta > 0 ? 'var(--success)' : outcome.delta < 0 ? 'var(--danger)' : 'var(--muted)';

  return (
    <Card className="animate-fade-up">
      <SectionTitle
        action={
          <span className="flex items-center gap-1 text-[11px] text-faint">
            <Lock size={12} /> {isToday ? 'Locks end of tomorrow' : 'Locks at midnight'}
          </span>
        }
      >
        {isToday ? "Today's match" : "Yesterday's match"}
      </SectionTitle>
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="font-hud tabular text-5xl font-bold leading-none">{outcome.score}</span>
          <span className="font-hud text-lg text-muted"> / 100</span>
        </div>
        <div className="text-right">
          {placement ? (
            <Chip color="var(--primary)">Placement match</Chip>
          ) : (
            <>
              <div className="font-hud tabular text-2xl font-bold leading-none" style={{ color: deltaColor }}>
                {outcome.delta > 0 ? '+' : ''}
                {outcome.delta} RP
              </div>
              <div className="mt-1 text-[11px] text-faint">if it ended now</div>
            </>
          )}
        </div>
      </div>
      {!placement && isToday && (
        <p className="mt-2 text-xs text-muted">
          Your rank expects <span className="font-semibold text-text">{breakEvenScore(lockedState.rating)}</span> to hold steady. Beat it to climb.
        </p>
      )}
      <ul className="mt-3 grid grid-cols-1 gap-1.5 min-[400px]:grid-cols-2">
        {(Object.keys(SCORE_WEIGHTS) as ScoredGoal[]).map((k) => (
          <li key={k} className="flex items-center gap-2 text-sm">
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${hit.has(k) ? 'bg-success/15 text-success' : 'bg-surface-3 text-faint'}`}
              aria-hidden
            >
              {hit.has(k) ? <Check size={13} strokeWidth={3} /> : <X size={12} />}
            </span>
            <span className={`min-w-0 flex-1 truncate ${hit.has(k) ? '' : 'text-muted'}`}>{SCORE_LABELS[k]}</span>
            <span className="tabular text-xs text-faint">{SCORE_WEIGHTS[k]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const RESULT_META = {
  victory: { label: 'Victory', color: 'var(--success)' },
  defeat: { label: 'Defeat', color: 'var(--danger)' },
  draw: { label: 'Draw', color: 'var(--muted)' },
  placement: { label: 'Placement', color: 'var(--primary)' },
} as const;

function HistoryCard({ outcomes }: { outcomes: MatchOutcome[] }) {
  const recent = [...outcomes].reverse().slice(0, 14);
  return (
    <Card>
      <SectionTitle>Match history</SectionTitle>
      {recent.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          No locked matches yet. Each day becomes a match result at the end of the following day.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {recent.map((o) => {
            const meta = RESULT_META[o.result];
            return (
              <li key={o.date} className="flex items-center gap-3 py-2.5">
                <span className="w-14 shrink-0 text-xs text-muted">
                  <span className="block font-semibold text-text">{formatWeekday(o.date)}</span>
                  {formatShortDate(o.date)}
                </span>
                <span className="w-1 self-stretch rounded-full" style={{ background: meta.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                  <span className="block truncate text-xs text-faint">
                    {o.change === 'placed'
                      ? `Placed in ${rankFromRating(o.ratingAfter).label}`
                      : o.change === 'promoted'
                        ? `Promoted to ${rankFromRating(o.ratingAfter).label}`
                        : o.change === 'demoted'
                          ? `Dropped to ${rankFromRating(o.ratingAfter).label}`
                          : o.shielded
                            ? 'Tier shield held'
                            : `${o.goals.length} of 6 goals`}
                  </span>
                </span>
                <span className="font-hud tabular w-10 text-right text-lg font-bold">{o.score}</span>
                <span className="font-hud tabular w-14 text-right text-sm font-semibold" style={{ color: meta.color }}>
                  {o.result === 'placement' ? '–' : `${o.delta > 0 ? '+' : ''}${o.delta}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function LadderCard({ state }: { state: RankState }) {
  const current = state.placed ? rankFromRating(state.rating).tier.id : null;
  return (
    <Card>
      <SectionTitle>The ladder</SectionTitle>
      <ul className="space-y-1">
        {[...TIERS].reverse().map((t, i, all) => {
          const top = i === 0 ? null : all[i - 1].floor - 1;
          const here = t.id === current;
          return (
            <li
              key={t.id}
              className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${here ? 'bg-surface-3/70 ring-1 ring-inset' : ''}`}
              style={here ? { ['--tw-ring-color' as string]: `color-mix(in srgb, ${tierColor(t.id)} 50%, transparent)` } : undefined}
            >
              <RankEmblem tier={t.id} size={34} />
              <span className="min-w-0 flex-1">
                <span className="font-hud block font-bold" style={{ color: tierTextColor(t.id) }}>
                  {t.name}
                </span>
                <span className="block text-xs text-faint tabular">{top === null ? `${t.floor.toLocaleString()}+ RP` : `${t.floor.toLocaleString()}–${top.toLocaleString()} RP`}</span>
              </span>
              {here && <Chip color={tierColor(t.id)}>You</Chip>}
              <span className="tabular w-16 text-right text-xs text-muted">needs ~{breakEvenScore(t.floor)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function RulesCard({ seasonStart }: { seasonStart: string }) {
  return (
    <Card>
      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Swords size={13} /> Rules of engagement
        </span>
      </SectionTitle>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted marker:text-faint">
        <li>Every day is a match, scored out of 100 from your daily goals. Calories count most, and only within 10% of target.</li>
        <li>Each rank expects a score. Beat it and you gain Rank Points. Fall short and you lose them. Higher ranks expect more.</li>
        <li>A day with nothing logged is a defeat. There are no rest days on the ladder.</li>
        <li>Your first {PLACEMENT_MATCHES} matches are placements. Placements can reach Platinum at most, and the rest is climbed.</li>
        <li>Reaching a new tier gives you a shield for 3 matches, so one bad day can't drop you straight back out.</li>
        <li>A day locks at the end of the next day. You can fix yesterday's log, but you can't rewrite the past.</li>
        <li>Rank is separate from your level. XP is never lost, but rank has to be held.</li>
      </ul>
      <p className="mt-3 text-xs text-faint">Season started {formatLongDate(seasonStart)}.</p>
    </Card>
  );
}
