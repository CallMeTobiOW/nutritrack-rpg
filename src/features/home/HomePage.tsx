import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Droplet, Flame, Plus, RotateCcw, ScanBarcode, ScrollText, Sparkles, Trophy } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../../db/db';
import { addWater, toggleQuest } from '../../db/actions';
import { briefingById } from '../../db/briefing';
import { SPEAKERS } from '../../data/briefings';
import { useAchievementUnlocks, useDayMetrics, usePlayer, useRank, usePlayerStats, useProfile, useSettings } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { ACHIEVEMENTS, TIER_COLORS } from '../../lib/achievements';
import { formatLongDate, greetingFor } from '../../lib/dates';
import { MACRO_KEYS, NUTRIENTS } from '../../lib/nutrients';
import { completeness, progress } from '../../lib/nutrition';
import { formatVolume } from '../../lib/units';
import { sfx } from '../../lib/sound';
import { Page } from '../../components/layout/Page';
import { MovedNotice } from '../../components/layout/MovedNotice';
import { Card, SectionTitle } from '../../components/ui/Card';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Button, IconButton } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { LevelBadge } from '../../components/game/LevelBadge';
import { XpBar } from '../../components/game/XpBar';
import { RankEmblem, tierTextColor } from '../../components/game/RankEmblem';
import { PLACEMENT_MATCHES, rankFromRating } from '../../lib/rank';
import { openBriefing } from '../briefing/BriefingOverlay';
import { SpeakerEmblem } from '../briefing/SpeakerEmblem';
import { QuestRow } from '../quests/QuestRow';
import { useQuestBoard } from '../quests/useQuestBoard';

const MACRO_COLORS = { protein: 'var(--protein)', carbs: 'var(--carbs)', fat: 'var(--fat)' } as const;

export function HomePage() {
  const today = useToday();
  const profile = useProfile();
  const player = usePlayer(today);
  const name = profile.name.trim();

  return (
    <Page>
      <header className="flex items-start justify-between gap-3 pb-4 pt-3">
        <div className="min-w-0">
          <p className="hud-label !text-primary">{formatLongDate(today)}</p>
          <h1 className="font-hud mt-1 text-[30px] font-bold leading-tight">
            {greetingFor()}
            {name ? ',' : ''} {name && <span className="text-gradient-gold">{name}</span>}
          </h1>
        </div>
        <IconButton label="Open today's briefing" onClick={openBriefing} className="mt-1 border border-line bg-surface">
          <ScrollText size={20} />
        </IconButton>
      </header>

      <div className="space-y-4">
        <MovedNotice />
        {player && (
          <Link to="/profile" className="block">
            <Card hud className="animate-fade-up flex items-center gap-4">
              <LevelBadge level={player.level.level} size={68} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-hud truncate text-xl font-bold">{player.title}</p>
                  <p className="flex shrink-0 items-center gap-1 text-sm font-semibold text-orange">
                    <Flame size={16} className="drop-shadow-[0_0_6px_var(--orange)]" />
                    {player.streak.current} day{player.streak.current === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="mt-2">
                  <XpBar level={player.level} showNumbers={false} />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-muted tabular">
                  <span>{player.level.remaining.toLocaleString()} XP to level {player.level.level + 1}</span>
                  <span className="font-semibold text-gold">+{player.xpToday} today</span>
                </div>
              </div>
            </Card>
          </Link>
        )}

        <RankCard />
        <CaloriesCard />
        <QuestsCard />
        <WaterCard />
        <BriefingCard />
        <AchievementsCard />
      </div>
    </Page>
  );
}

function CaloriesCard() {
  const today = useToday();
  const profile = useProfile();
  const m = useDayMetrics(today);
  const navigate = useNavigate();
  if (!m) return <Card className="h-64" />;
  const kcal = progress(m.totals.energy.value, profile.targets.calories);
  const over = kcal.remaining < 0;
  const partial = completeness(m.totals.energy) === 'partial';

  return (
    <Card className="animate-fade-up overflow-hidden" style={{ animationDelay: '0.05s' }}>
      <SectionTitle
        action={
          <Link to="/food" className="flex items-center text-xs font-semibold text-primary">
            Diary <ChevronRight size={14} />
          </Link>
        }
      >
        Fuel
      </SectionTitle>
      <div className="flex items-center gap-4">
        <ProgressRing value={kcal.ratio} size={150} stroke={13} label={`${Math.round(kcal.consumed)} of ${kcal.target} kcal`}>
          <div>
            <div className={`font-hud tabular text-[34px] font-bold leading-none ${over ? 'text-danger' : ''}`}>
              {Math.abs(Math.round(kcal.remaining)).toLocaleString()}
            </div>
            <div className="hud-label mt-1 !text-[10px]">{over ? 'kcal over' : 'kcal left'}</div>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Eaten</span>
            <span className="font-semibold tabular">{Math.round(kcal.consumed).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Target</span>
            <span className="font-semibold tabular">{kcal.target.toLocaleString()}</span>
          </div>
          {MACRO_KEYS.map((k) => {
            const p = progress(m.totals[k].value, profile.targets[k]);
            return (
              <div key={k}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="h-2 w-2 rounded-full" style={{ background: MACRO_COLORS[k] }} aria-hidden />
                    {NUTRIENTS[k].label === 'Carbohydrates' ? 'Carbs' : NUTRIENTS[k].label}
                  </span>
                  <span className="tabular text-muted">
                    {Math.round(p.consumed)}/{p.target} g
                  </span>
                </div>
                <ProgressBar value={p.ratio} color={MACRO_COLORS[k]} height={5} label={NUTRIENTS[k].label} />
              </div>
            );
          })}
        </div>
      </div>
      {partial && <p className="mt-3 text-xs text-orange">Some foods today have no calorie data, so the total may be low.</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => navigate('/food/add?meal=auto')}>
          <Plus size={18} /> Log food
        </Button>
        <Button variant="secondary" onClick={() => navigate('/food/scan?meal=auto')}>
          <ScanBarcode size={18} /> Scan
        </Button>
      </div>
    </Card>
  );
}

function QuestsCard() {
  const today = useToday();
  const board = useQuestBoard(today);
  if (!board) return <Card className="h-48" />;
  const daily = board.byCategory.get('daily') ?? [];
  const pending = daily.filter((q) => !board.isDone(q));
  const shown = [...pending, ...daily.filter((q) => board.isDone(q))];

  return (
    <Card className="animate-fade-up" style={{ animationDelay: '0.1s' }}>
      <SectionTitle
        action={
          <Link to="/quests" className="flex items-center text-xs font-semibold text-primary">
            Quest board <ChevronRight size={14} />
          </Link>
        }
      >
        Today&apos;s missions
      </SectionTitle>
      <div className="mb-3 flex items-center gap-3">
        <div className="font-hud tabular text-3xl font-bold leading-none">
          {board.dailyProgress.completed}
          <span className="text-lg text-muted">/{board.dailyProgress.total}</span>
        </div>
        <div className="min-w-0 flex-1">
          <ProgressBar value={board.dailyProgress.percent / 100} color="var(--success)" to="var(--cyan)" label="Daily missions" />
          <p className="mt-1 text-xs text-muted">
            {pending.length === 0 && daily.length > 0 ? 'All daily missions complete. Outstanding work.' : 'Clear every daily mission for bonus XP.'}
          </p>
        </div>
      </div>
      <div className="space-y-2">
        {shown.map((q) => (
          <QuestRow key={q.id} quest={q} compact done={board.isDone(q)} autoProgress={board.autoText(q)} onToggle={() => void toggleQuest(q.id, today)} />
        ))}
      </div>
    </Card>
  );
}

function WaterCard() {
  const today = useToday();
  const profile = useProfile();
  const { waterQuickAmounts } = useSettings();
  const quick = waterQuickAmounts.length ? waterQuickAmounts.slice(0, 3) : [250, 500, 750];
  const m = useDayMetrics(today);
  const ml = m?.waterMl ?? 0;
  const p = progress(ml, profile.targets.waterMl);
  const add = (amount: number) => {
    sfx.tick();
    void addWater(today, amount);
  };
  return (
    <Card className="animate-fade-up" style={{ animationDelay: '0.15s' }}>
      <SectionTitle
        action={
          <Link to="/water" className="flex items-center text-xs font-semibold text-primary">
            Hydration <ChevronRight size={14} />
          </Link>
        }
      >
        Water
      </SectionTitle>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan/15 text-cyan">
          <Droplet size={22} className="drop-shadow-[0_0_6px_var(--cyan)]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <span className="font-hud tabular text-2xl font-bold">{formatVolume(ml)}</span>
            <span className="text-sm text-muted tabular">
              {p.remaining > 0 ? `${formatVolume(p.remaining)} to go` : 'Goal reached'} · {p.percent}%
            </span>
          </div>
          <ProgressBar value={p.ratio} color="var(--cyan)" to="var(--primary-2)" className="mt-1.5" label="Water" />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {quick.map((a) => (
          <Button key={a} size="sm" variant="secondary" onClick={() => add(a)}>
            +{a} ml
          </Button>
        ))}
      </div>
    </Card>
  );
}

function BriefingCard() {
  const today = useToday();
  const record = useLiveQuery(() => db.briefings.get(today), [today]);
  const b = briefingById(record?.currentId ?? record?.messageId);
  if (!b) return null;
  const speaker = SPEAKERS[b.category];
  return (
    <Card className="animate-fade-up" style={{ animationDelay: '0.2s' }}>
      <SectionTitle
        action={
          <button type="button" onClick={openBriefing} className="flex items-center gap-1 text-xs font-semibold text-primary">
            <RotateCcw size={13} /> Replay
          </button>
        }
      >
        Today&apos;s briefing
      </SectionTitle>
      <div className="flex gap-3">
        <SpeakerEmblem category={b.category} size={40} />
        <div className="min-w-0">
          <p className="text-[15px] leading-relaxed">“{b.text}”</p>
          <p className="mt-1.5 text-xs font-semibold" style={{ color: speaker.ink }}>
            {speaker.name}
          </p>
        </div>
      </div>
    </Card>
  );
}

function AchievementsCard() {
  const today = useToday();
  const unlocks = useAchievementUnlocks();
  const stats = usePlayerStats(today);
  const { todays, next } = useMemo(() => {
    const ids = new Set(unlocks?.map((u) => u.id));
    const todays = ACHIEVEMENTS.filter((a) => unlocks?.some((u) => u.id === a.id && u.date === today));
    const locked = stats
      ? ACHIEVEMENTS.filter((a) => !ids.has(a.id))
          .map((a) => {
            const [cur, goal] = a.progress(stats);
            return { a, cur, goal, ratio: cur / goal };
          })
          // Closest to unlocking first: fewest steps remaining, then furthest along.
          .sort((x, y) => x.goal - x.cur - (y.goal - y.cur) || y.ratio - x.ratio)
      : [];
    return { todays, next: locked.slice(0, 2) };
  }, [unlocks, stats, today]);

  return (
    <Card className="animate-fade-up" style={{ animationDelay: '0.25s' }}>
      <SectionTitle
        action={
          <Link to="/quests?tab=achievements" className="flex items-center text-xs font-semibold text-primary">
            All <ChevronRight size={14} />
          </Link>
        }
      >
        Achievements
      </SectionTitle>
      {todays.length > 0 && (
        <div className="mb-3 space-y-2">
          {todays.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/10 p-3">
              <Icon name={a.icon} size={22} color={TIER_COLORS[a.tier]} />
              <div className="min-w-0 flex-1">
                <p className="hud-label !text-[10px] !text-gold">Unlocked today</p>
                <p className="truncate font-semibold">{a.title}</p>
              </div>
              <Sparkles size={18} className="text-gold" />
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {next.map(({ a, cur, goal, ratio }) => (
          <div key={a.id} className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-faint">
              <Icon name={a.icon} size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2 text-sm">
                <span className="truncate font-medium">{a.title}</span>
                <span className="shrink-0 tabular text-muted">
                  {cur}/{goal}
                </span>
              </div>
              <ProgressBar value={ratio} color={TIER_COLORS[a.tier]} height={5} className="mt-1.5" label={a.title} />
            </div>
          </div>
        ))}
        {next.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Trophy size={16} className="text-gold" /> Every achievement unlocked. Legendary.
          </p>
        )}
      </div>
    </Card>
  );
}

function RankCard() {
  const today = useToday();
  const rank = useRank(today);
  if (!rank) return null;
  const state = rank.locked.state;
  const live = rank.pending.find((o) => o.date === today);
  const r = rankFromRating(state.rating);
  const delta = live && live.result !== 'placement' ? live.delta : null;

  return (
    <Link to="/profile/rank" className="block">
      <Card className="animate-fade-up flex items-center gap-3 !py-3" style={{ animationDelay: '0.03s' }}>
        <RankEmblem tier={r.tier.id} division={state.placed ? r.division : null} unranked={!state.placed} size={44} />
        <div className="min-w-0 flex-1">
          <p className="hud-label !text-[10px]">Competitive rank</p>
          <p className="font-hud truncate text-lg font-bold leading-tight" style={state.placed ? { color: tierTextColor(r.tier.id) } : undefined}>
            {state.placed ? r.label : `Placements ${state.placementsPlayed}/${PLACEMENT_MATCHES}`}
          </p>
        </div>
        {live && (
          <div className="shrink-0 text-right">
            <p className="font-hud tabular text-lg font-bold leading-tight">
              {live.score}
              <span className="text-xs text-muted">/100</span>
            </p>
            <p
              className="tabular text-xs font-semibold"
              style={{ color: delta === null ? 'var(--muted)' : delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--muted)' }}
            >
              {delta === null ? "today's match" : `${delta > 0 ? '+' : ''}${delta} RP so far`}
            </p>
          </div>
        )}
        <ChevronRight size={18} className="shrink-0 text-faint" />
      </Card>
    </Link>
  );
}
