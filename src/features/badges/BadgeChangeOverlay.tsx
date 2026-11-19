import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { updateSettings } from '../../db/actions';
import { useBadges, useRank } from '../../hooks/useData';
import type { DateKey } from '../../lib/dates';
import { BADGE_IDS, badgeChanges, seenBadgeStep, stepLabel, stepFloor, type BadgeChange, type BadgeStanding, type BadgeId, type BadgeSeen, type BadgeState } from '../../lib/badges';
import { rankFromRating, seenStep } from '../../lib/rank';
import { celebrate } from '../../lib/celebrations';
import { sfx } from '../../lib/sound';
import { Button } from '../../components/ui/Button';
import { RankEmblem, tierColor, tierTextColor } from '../../components/game/RankEmblem';

/**
 * Announces badge changes once, after the daily briefing and any rank change.
 * Claims and new tiers get a full-screen moment; division-ups get a toast;
 * drops are only shown on the Badges tab, so a slip never ambushes the player.
 */
export function BadgeChangeGate({ today }: { today: DateKey }) {
  const badges = useBadges(today);
  const rank = useRank(today);
  const briefing = useLiveQuery(async () => (await db.briefings.get(today)) ?? null, [today]);

  const pending = useMemo(() => {
    if (!badges || !rank || briefing === undefined || briefing?.acknowledged === false) return null;
    // Let the rank change overlay go first.
    if (rank.seenStep !== undefined && seenStep(rank.locked.state) !== rank.seenStep) return null;
    const states = Object.fromEntries(badges.standings.map((b) => [b.def.id, b.locked])) as Record<BadgeId, BadgeState>;
    const changes = badgeChanges(states, badges.seen ?? {});
    if (changes.length === 0) return null;
    const next: BadgeSeen = Object.fromEntries(BADGE_IDS.map((id) => [id, seenBadgeStep(states[id])]));
    return { changes, next, big: changes.some((c) => c.kind === 'claimed' || c.kind === 'tier') };
  }, [badges, rank, briefing]);

  // Division-ups and drops don't need a full-screen moment: toast the ups and record what was seen.
  useEffect(() => {
    if (!pending || pending.big) return;
    for (const c of pending.changes) {
      if (c.kind !== 'division') continue;
      const b = badges?.standings.find((s) => s.def.id === c.id);
      if (b) celebrate({ kind: 'badge', id: c.id, icon: b.def.icon, tier: rankFromRating(stepFloor(c.to)).tier.id, title: `${b.def.title} ${stepLabel(c.to)}` });
    }
    void updateSettings({ badgeSeen: pending.next });
  }, [pending, badges]);

  if (!pending?.big || !badges) return null;
  const ups = pending.changes.filter((c) => c.kind !== 'drop');
  return <BadgeMoment changes={ups} standings={badges.standings} onDone={() => void updateSettings({ badgeSeen: pending.next })} />;
}

function BadgeMoment({ changes, standings, onDone }: { changes: BadgeChange[]; standings: BadgeStanding[]; onDone: () => void }) {
  // Lead with the biggest moment: a new tier or a claim, then the highest step.
  const weight = (c: BadgeChange) => (c.kind === 'division' ? 0 : 1000) + c.to;
  const ordered = [...changes].sort((a, b) => weight(b) - weight(a));
  const lead = ordered[0];
  const leadDef = standings.find((s) => s.def.id === lead.id)!;
  const leadRank = rankFromRating(stepFloor(lead.to));
  const color = tierColor(leadRank.tier.id);
  const kicker = ordered.length > 1 ? 'Badges advanced' : lead.kind === 'claimed' ? 'Badge claimed' : lead.kind === 'tier' ? 'Badge tier up' : 'Badge ranked up';

  useEffect(() => {
    sfx.fanfare();
  }, []);

  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-[70] grid place-items-center bg-[var(--backdrop)] p-6 backdrop-blur-md" role="dialog" aria-label={kicker}>
      <div className="panel hud-corners animate-pop relative w-full max-w-sm overflow-hidden p-7 text-center">
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(circle at 50% 10%, color-mix(in srgb, ${color} 30%, transparent), transparent 65%)` }} />
        <p className="hud-label relative" style={{ color: tierTextColor(leadRank.tier.id) }}>
          {kicker}
        </p>
        <RankEmblem tier={leadRank.tier.id} division={leadRank.division} glyph={leadDef.def.icon} size={112} label={`${leadDef.def.title}: ${leadRank.label}`} className="relative mx-auto mt-3" />
        <p className="relative mt-2 font-semibold">{leadDef.def.title}</p>
        <p className="font-hud relative text-4xl font-bold leading-none" style={{ color: tierTextColor(leadRank.tier.id) }}>
          {leadRank.label}
        </p>
        <p className="relative mt-2 text-sm text-muted">{lead.kind === 'claimed' ? leadDef.def.lore : lead.kind === 'tier' ? 'A new metal, earned one day at a time. Now hold it.' : 'Another division climbed. Keep the run going.'}</p>

        {ordered.length > 1 && (
          <ul className="relative mt-4 space-y-1.5 text-left">
            {ordered.slice(1).map((c) => {
              const s = standings.find((x) => x.def.id === c.id)!;
              const r = rankFromRating(stepFloor(c.to));
              return (
                <li key={c.id} className="flex items-center gap-2 rounded-xl bg-surface-3/50 px-2 py-1.5">
                  <RankEmblem tier={r.tier.id} division={null} glyph={s.def.icon} size={26} label={`${s.def.title}: ${r.label}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.def.title}</span>
                  <span className="font-hud text-sm font-bold" style={{ color: tierTextColor(r.tier.id) }}>
                    {r.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="gold" block className="relative mt-6" onClick={onDone}>
          Continue
        </Button>
      </div>
    </div>,
    document.body,
  );
}
