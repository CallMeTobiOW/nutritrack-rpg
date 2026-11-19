import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, Swords, ChevronRight, Droplet, Flag, Flame, Medal, Scale, Settings, SlidersHorizontal, Star, UserRound } from 'lucide-react';
import { db } from '../../db/db';
import { useAchievementUnlocks, usePlayer, useRank, usePlayerStats, useProfile, useSettings, useWeights } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { ACHIEVEMENTS, TIER_COLORS } from '../../lib/achievements';
import { addDays, formatLongDate } from '../../lib/dates';
import { OBJECTIVES } from '../../lib/targets';
import { formatWeight } from '../../lib/units';
import { nextRank } from '../../lib/xp';
import { PLACEMENT_MATCHES, rankFromRating } from '../../lib/rank';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/Misc';
import { Icon } from '../../components/ui/Icon';
import { LevelBadge } from '../../components/game/LevelBadge';
import { XpBar } from '../../components/game/XpBar';

export default function ProfilePage() {
  const today = useToday();
  const navigate = useNavigate();
  const profile = useProfile();
  const player = usePlayer(today);
  const stats = usePlayerStats(today);
  const unlocks = useAchievementUnlocks();
  const weights = useWeights();
  const { weightUnit } = useSettings();

  const loggedLast30 = useLiveQuery(async () => {
    const entries = await db.diary.where('date').between(addDays(today, -29), today, true, true).toArray();
    return new Set(entries.map((e) => e.date)).size;
  }, [today]);
  const firstDay = useLiveQuery(async () => (await db.diary.orderBy('date').first())?.date, []);

  const milestones = useMemo(() => {
    const out: { icon: ReactNode; text: string }[] = [];
    if (firstDay) out.push({ icon: <Flag size={16} />, text: `Campaign started ${formatLongDate(firstDay)}` });
    if (weights && weights.length > 1) {
      const diff = weights[weights.length - 1].kg - weights[0].kg;
      if (Math.abs(diff) >= 0.1) out.push({ icon: <Scale size={16} />, text: `${diff < 0 ? 'Down' : 'Up'} ${formatWeight(Math.abs(diff), weightUnit)} since your first weigh-in` });
    }
    if (player && player.streak.best >= 2) out.push({ icon: <Flame size={16} />, text: `Best streak: ${player.streak.best} days` });
    if (stats && stats.fullClearDays > 0) out.push({ icon: <Star size={16} />, text: `${stats.fullClearDays} day${stats.fullClearDays === 1 ? '' : 's'} with every daily mission cleared` });
    return out;
  }, [firstDay, weights, player, stats, weightUnit]);

  const recentBadges = useMemo(
    () =>
      [...(unlocks ?? [])]
        .sort((a, b) => b.unlockedAt - a.unlockedAt)
        .slice(0, 6)
        .map((u) => ACHIEVEMENTS.find((a) => a.id === u.id))
        .filter((a): a is (typeof ACHIEVEMENTS)[number] => !!a),
    [unlocks],
  );

  const consistency = loggedLast30 === undefined ? 0 : Math.round((loggedLast30 / 30) * 100);
  const upcoming = player ? nextRank(player.level.level) : null;

  return (
    <Page>
      <PageHeader kicker="Character" title="Profile" />

      {player && (
        <Card hud className="mb-4 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,color-mix(in_srgb,var(--gold)_14%,transparent),transparent_55%)]" />
          <div className="relative flex items-center gap-4">
            <LevelBadge level={player.level.level} size={84} />
            <div className="min-w-0 flex-1">
              <p className="font-hud truncate text-2xl font-bold leading-tight">{profile.name || 'Champion'}</p>
              <p className="text-gradient-gold font-hud text-lg font-semibold">{player.title}</p>
              <p className="text-xs text-muted">{OBJECTIVES[profile.objective].label}</p>
            </div>
          </div>
          <div className="relative mt-4">
            <XpBar level={player.level} />
            {upcoming && <p className="mt-1 text-xs text-faint">Next title: {upcoming.title} at level {upcoming.level}</p>}
          </div>
          <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
            <ProfileStat label="Total XP" value={player.xp.toLocaleString()} />
            <ProfileStat label="Streak" value={`${player.streak.current}d`} sub={`best ${player.streak.best}d`} />
            <ProfileStat label="Quests" value={String(player.questsCompleted)} />
            <ProfileStat label="Badges" value={`${unlocks?.length ?? 0}/${ACHIEVEMENTS.length}`} />
            <ProfileStat label="Consistency" value={`${consistency}%`} sub="days logged, 30d" />
            <ProfileStat label="Days logged" value={String(stats?.daysLogged ?? 0)} />
          </div>
        </Card>
      )}

      {recentBadges.length > 0 && (
        <Card className="mb-4">
          <SectionTitle>Recent badges</SectionTitle>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1">
            {recentBadges.map((a) => (
              <button key={a.id} type="button" onClick={() => navigate('/quests?tab=achievements')} className="flex w-16 shrink-0 flex-col items-center text-center">
                <span
                  className="grid h-14 w-14 place-items-center rounded-2xl"
                  style={{ background: `color-mix(in srgb, ${TIER_COLORS[a.tier]} 16%, transparent)`, boxShadow: `0 0 18px -6px ${TIER_COLORS[a.tier]}` }}
                >
                  <Icon name={a.icon} size={24} color={TIER_COLORS[a.tier]} />
                </span>
                <span className="mt-1 line-clamp-2 text-[11px] leading-tight text-muted">{a.title}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {milestones.length > 0 && (
        <Card className="mb-4">
          <SectionTitle>Milestones</SectionTitle>
          <ul className="space-y-2.5">
            {milestones.map((m) => (
              <li key={m.text} className="flex items-center gap-3 text-sm">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-3 text-gold">{m.icon}</span>
                {m.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card padded={false} className="divide-y divide-line overflow-hidden">
        <RankMenuRow />
        <MenuRow icon={<UserRound size={19} />} title="Personal details" sub="Age, height, activity, objective" to="/profile/details" />
        <MenuRow icon={<SlidersHorizontal size={19} />} title="Goals & targets" sub={`${profile.targets.calories.toLocaleString()} kcal · ${profile.targets.protein} g protein`} to="/profile/targets" />
        <MenuRow icon={<Scale size={19} />} title="Weight tracker" sub={weights?.length ? `Latest ${formatWeight(weights[weights.length - 1].kg, weightUnit)}` : 'Log your first weigh-in'} to="/profile/weight" />
        <MenuRow icon={<Droplet size={19} />} title="Hydration" sub="Water log and history" to="/water" />
        <MenuRow icon={<BarChart3 size={19} />} title="Statistics" sub="Averages, trends and consistency" to="/profile/stats" />
        <MenuRow icon={<Medal size={19} />} title="Achievements" sub={`${unlocks?.length ?? 0} of ${ACHIEVEMENTS.length} unlocked`} to="/quests?tab=achievements" />
        <MenuRow icon={<Settings size={19} />} title="Settings & data" sub="Theme, sound, backup, privacy" to="/profile/settings" />
      </Card>
    </Page>
  );
}

function ProfileStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-3/40 px-1 py-2">
      <div className="font-hud tabular text-xl font-bold leading-tight">{value}</div>
      <div className="hud-label !text-[9px]">{label}</div>
      {sub && <div className="text-[10px] text-faint">{sub}</div>}
    </div>
  );
}

function MenuRow({ icon, title, sub, to }: { icon: ReactNode; title: string; sub: string; to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-surface-3/60">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block truncate text-sm text-muted">{sub}</span>
      </span>
      <ChevronRight size={18} className="text-faint" />
    </button>
  );
}

function RankMenuRow() {
  const today = useToday();
  const rank = useRank(today);
  const state = rank?.locked.state;
  const sub = !state ? 'Loading…' : state.placed ? `${rankFromRating(state.rating).label} · ${state.rating.toLocaleString()} RP` : `Placements ${state.placementsPlayed}/${PLACEMENT_MATCHES}`;
  return <MenuRow icon={<Swords size={19} />} title="Competitive rank" sub={sub} to="/profile/rank" />;
}
