import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Crown, Flame, Hexagon, Lock, Pencil, Plus, Sparkles } from 'lucide-react';
import { toggleQuest } from '../../db/actions';
import { useAchievementUnlocks, usePlayer, usePlayerStats, useProfile, useSettings, useXpEvents } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { ACHIEVEMENTS, TIER_COLORS, type AchievementDef } from '../../lib/achievements';
import { addDays, diffDays, formatLongDate, formatShortDate, lastNDays, toDateKey } from '../../lib/dates';
import type { Quest } from '../../lib/models';
import { CATEGORY_META, bonusEventId } from '../../lib/quests';
import { cn } from '../../lib/cn';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { Chip, PageHeader } from '../../components/ui/Misc';
import { IconButton } from '../../components/ui/Button';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Segmented } from '../../components/ui/Segmented';
import { Sheet } from '../../components/ui/Sheet';
import { Icon } from '../../components/ui/Icon';
import { QuestRow } from './QuestRow';
import { QuestEditor } from './QuestEditor';
import { CATEGORY_ORDER, useQuestBoard } from './useQuestBoard';
import { BadgesPanel } from '../badges/BadgesPanel';

type Tab = 'board' | 'badges' | 'achievements' | 'history';

export default function QuestsPage() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const tab = (['board', 'badges', 'achievements', 'history'].includes(params.get('tab') ?? '') ? params.get('tab') : 'board') as Tab;
  const board = useQuestBoard(today);
  const player = usePlayer(today);
  const settings = useSettings();
  const [editMode, setEditMode] = useState(false);
  const [editor, setEditor] = useState<{ quest?: Quest } | null>(null);

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next, { replace: true });
  };

  return (
    <Page>
      <PageHeader
        kicker="Mission control"
        title="Quest Board"
        actions={
          tab === 'board' && (
            <>
              <IconButton label={editMode ? 'Done editing' : 'Edit quests'} onClick={() => setEditMode((v) => !v)} className={editMode ? 'bg-primary/15 text-primary' : ''}>
                {editMode ? <Check size={20} /> : <Pencil size={19} />}
              </IconButton>
              <IconButton label="Add quest" onClick={() => setEditor({})} className="text-primary">
                <Plus size={22} />
              </IconButton>
            </>
          )
        }
      />

      {board && player && (
        <Card hud className="mb-4 flex items-center gap-4">
          <ProgressRing value={board.progress.percent / 100} size={96} stroke={9} from="var(--success)" to="var(--cyan)" label={`${board.progress.percent}% of quests complete`}>
            <div>
              <div className="font-hud tabular text-2xl font-bold leading-none">{board.progress.percent}%</div>
              <div className="text-[10px] text-muted">complete</div>
            </div>
          </ProgressRing>
          <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2.5">
            <HudStat label="Quests" value={`${board.progress.completed}/${board.progress.total}`} />
            <HudStat label="XP today" value={`+${player.xpToday}`} gold />
            <HudStat label="Streak" value={`${player.streak.current}d`} icon={<Flame size={14} className="text-orange" />} />
            <HudStat label="Level" value={`${player.level.level}`} />
          </div>
        </Card>
      )}

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'board', label: 'Board' },
          { value: 'badges', label: 'Badges' },
          { value: 'achievements', label: 'Feats' },
          { value: 'history', label: 'History' },
        ]}
      />

      {tab === 'board' && board && (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const quests = board.byCategory.get(cat) ?? [];
            if (quests.length === 0 && !editMode) return null;
            const done = quests.filter(board.isDone).length;
            const bonusEarned = cat === 'daily' && board.events.has(bonusEventId(today));
            return (
              <section key={cat}>
                <div className="mb-2 flex items-end justify-between gap-2 px-1">
                  <div>
                    <h2 className="font-hud text-lg font-bold uppercase tracking-[0.12em]">{CATEGORY_META[cat].label}</h2>
                    <p className="text-xs text-muted">
                      {cat === 'daily' && settings.allDailyBonusXp > 0 ? `Clear them all for +${settings.allDailyBonusXp} bonus XP.` : CATEGORY_META[cat].hint}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {bonusEarned && (
                      <Chip color="var(--gold)">
                        <Crown size={11} /> Bonus
                      </Chip>
                    )}
                    <span className="font-hud tabular text-sm font-semibold text-muted">
                      {done}/{quests.length}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {quests.map((q) => (
                    <QuestRow
                      key={q.id}
                      quest={q}
                      done={board.isDone(q)}
                      autoProgress={board.autoText(q)}
                      onToggle={() => void toggleQuest(q.id, today)}
                      onEdit={editMode ? () => setEditor({ quest: q }) : undefined}
                    />
                  ))}
                  {quests.length === 0 && <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-faint">No quests here yet.</p>}
                </div>
              </section>
            );
          })}
          <p className="px-1 text-xs text-faint">
            Daily quests reset at midnight, weekly objectives every Monday. Missing a day never costs you XP. Just pick up where you left off.
          </p>
        </div>
      )}

      {tab === 'badges' && <BadgesPanel />}
      {tab === 'achievements' && <AchievementsGrid />}
      {tab === 'history' && <QuestHistory />}

      <QuestEditor open={!!editor} quest={editor?.quest} onClose={() => setEditor(null)} existing={board?.quests ?? []} />
    </Page>
  );
}

function HudStat({ label, value, gold, icon }: { label: string; value: string; gold?: boolean; icon?: ReactNode }) {
  return (
    <div>
      <div className="hud-label !text-[9px]">{label}</div>
      <div className={cn('font-hud tabular flex items-center gap-1 text-xl font-bold leading-tight', gold && 'text-gradient-gold')}>
        {icon}
        {value}
      </div>
    </div>
  );
}

function AchievementsGrid() {
  const today = useToday();
  const unlocks = useAchievementUnlocks();
  const stats = usePlayerStats(today);
  const [open, setOpen] = useState<AchievementDef | null>(null);
  const unlockedMap = useMemo(() => new Map((unlocks ?? []).map((u) => [u.id, u])), [unlocks]);
  const count = unlockedMap.size;

  return (
    <div>
      <Card className="mb-4">
        <div className="flex items-baseline justify-between">
          <span className="hud-label">Unlocked</span>
          <span className="font-hud tabular text-2xl font-bold">
            {count}
            <span className="text-base text-muted">/{ACHIEVEMENTS.length}</span>
          </span>
        </div>
        <ProgressBar value={count / ACHIEVEMENTS.length} color="var(--gold)" to="var(--orange)" className="mt-2" label="Achievements unlocked" />
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const u = unlockedMap.get(a.id);
          const [cur, goal] = stats ? a.progress(stats) : [0, 1];
          const color = TIER_COLORS[a.tier];
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpen(a)}
              className={cn('panel flex flex-col items-center p-4 text-center transition active:scale-[0.98]', !u && 'opacity-80')}
              style={u ? { borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, boxShadow: `0 0 24px -10px ${color}` } : undefined}
            >
              <Badge icon={a.icon} color={color} unlocked={!!u} />
              <span className={cn('mt-2 text-sm font-semibold leading-tight', !u && 'text-muted')}>{a.title}</span>
              {u ? (
                <span className="mt-1 text-[11px] text-faint">{formatShortDate(u.date)}</span>
              ) : (
                <div className="mt-2 w-full">
                  <ProgressBar value={cur / goal} color={color} height={4} label={a.title} />
                  <span className="mt-1 block text-[11px] text-faint tabular">
                    {cur}/{goal}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title}>
        {open && (
          <div className="flex flex-col items-center pb-4 pt-2 text-center">
            <Badge icon={open.icon} color={TIER_COLORS[open.tier]} unlocked={unlockedMap.has(open.id)} size={96} />
            <Chip color={TIER_COLORS[open.tier]} className="mt-3">
              {open.tier}
            </Chip>
            <p className="mt-3 text-muted">{open.description}</p>
            <p className="font-hud mt-2 text-lg font-bold text-gold">+{open.xp} XP</p>
            {unlockedMap.get(open.id) && <p className="mt-1 text-sm text-faint">Unlocked {formatLongDate(unlockedMap.get(open.id)!.date)}</p>}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** Hexagonal badge, lit when unlocked. */
function Badge({ icon, color, unlocked, size = 64 }: { icon: string; color: string; unlocked: boolean; size?: number }) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0" style={unlocked ? { filter: `drop-shadow(0 0 8px ${color}88)` } : undefined}>
        <polygon
          points="50,4 92,28 92,72 50,96 8,72 8,28"
          fill={unlocked ? `color-mix(in srgb, ${color} 18%, var(--surface-2))` : 'var(--surface-3)'}
          stroke={unlocked ? color : 'var(--line-strong)'}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
      {unlocked ? <Icon name={icon} size={size * 0.4} color={color} className="relative" /> : <Lock size={size * 0.3} className="relative text-faint" />}
    </div>
  );
}

function QuestHistory() {
  const today = useToday();
  const events = useXpEvents();
  const board = useQuestBoard(today);
  const profile = useProfile();

  const { days, recent, rate7, rate30 } = useMemo(() => {
    const evs = events ?? [];
    const dailyCount = board?.quests.filter((q) => q.recurrence === 'daily').length ?? 0;
    const byDay = (d: string) => evs.filter((e) => e.date === d);
    // Only count days since the campaign began, so a new player isn't shown weeks of empty rows.
    const firstEvent = evs.reduce<string>((min, e) => (e.date < min ? e.date : min), today);
    const created = profile.createdAt ? toDateKey(new Date(profile.createdAt)) : today;
    const start = firstEvent < created ? firstEvent : created;
    const span = (n: number) => Math.max(1, Math.min(n, diffDays(start, today) + 1));
    const days = lastNDays(today, span(14))
      .reverse()
      .map((d) => {
        const list = byDay(d);
        const quests = list.filter((e) => e.kind === 'quest');
        return { date: d, quests: quests.length, xp: list.reduce((s, e) => s + e.xp, 0), fullClear: list.some((e) => e.kind === 'bonus') };
      });
    const rate = (window: number) => {
      const n = span(window);
      if (!dailyCount) return 0;
      const from = addDays(today, -(n - 1));
      const done = evs.filter((e) => e.kind === 'quest' && e.date >= from && e.period.length === 10).length;
      return Math.min(100, Math.round((done / (dailyCount * n)) * 100));
    };
    const recent = [...evs].sort((a, b) => b.createdAt - a.createdAt).slice(0, 25);
    return { days, recent, rate7: rate(7), rate30: rate(30) };
  }, [events, board?.quests, today, profile.createdAt]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="hud-label !text-[10px]">Completion · 7 days</div>
          <div className="font-hud tabular text-3xl font-bold">{rate7}%</div>
          <ProgressBar value={rate7 / 100} color="var(--success)" height={5} className="mt-1" label="7-day completion" />
        </Card>
        <Card>
          <div className="hud-label !text-[10px]">Completion · 30 days</div>
          <div className="font-hud tabular text-3xl font-bold">{rate30}%</div>
          <ProgressBar value={rate30 / 100} color="var(--success)" height={5} className="mt-1" label="30-day completion" />
        </Card>
      </div>
      <Card>
        <SectionTitle>{days.length < 14 ? 'Since you started' : 'Last 14 days'}</SectionTitle>
        <ul className="divide-y divide-line">
          {days.map((d) => (
            <li key={d.date} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-24 shrink-0 text-muted">{d.date === today ? 'Today' : formatShortDate(d.date)}</span>
              <span className="flex-1 tabular">
                {d.quests} quest{d.quests === 1 ? '' : 's'}
                {d.fullClear && <Crown size={13} className="ml-1.5 inline text-gold" aria-label="All daily missions complete" />}
              </span>
              <span className={cn('font-hud tabular font-bold', d.xp ? 'text-gold' : 'text-faint')}>+{d.xp} XP</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <SectionTitle>XP log</SectionTitle>
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Complete a quest to start your chronicle.</p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted">
                  {e.kind === 'achievement' ? <Sparkles size={15} className="text-gold" /> : e.kind === 'badge' ? <Hexagon size={15} className="text-primary" /> : e.kind === 'bonus' ? <Crown size={15} className="text-gold" /> : <Check size={15} className="text-success" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.title}</span>
                  <span className="block text-xs text-faint">{formatShortDate(e.date)}</span>
                </span>
                <span className="font-hud tabular font-bold text-gold">+{e.xp}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
