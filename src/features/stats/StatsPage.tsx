import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Flame } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../../db/db';
import { usePlayer, useProfile, useQuests, useRangeMetrics, useSettings, useWeights, useXpEvents } from '../../hooks/useData';
import { useToday } from '../../hooks/useToday';
import { addDays, dateRange, diffDays, formatShortDate, formatWeekday, startOfWeek, type DateKey } from '../../lib/dates';
import { plural } from '../../lib/food';
import { periodAverages } from '../../lib/stats';
import type { DayMetrics } from '../../lib/quests';
import { formatVolume, formatWeight } from '../../lib/units';
import { Page } from '../../components/layout/Page';
import { Card, SectionTitle } from '../../components/ui/Card';
import { PageHeader } from '../../components/ui/Misc';
import { Segmented } from '../../components/ui/Segmented';
import { AXIS_TICK, GRID_STROKE, Legend, TooltipCard } from '../../components/charts/ChartTooltip';

type Range = '7' | '30' | '90' | 'all';

export default function StatsPage() {
  const today = useToday();
  const [range, setRange] = useState<Range>('7');
  const earliest = useLiveQuery(async () => {
    const firsts = await Promise.all([db.diary.orderBy('date').first(), db.water.orderBy('date').first(), db.weights.orderBy('date').first(), db.xpEvents.orderBy('date').first()]);
    const dates = firsts.map((f) => f?.date).filter((d): d is string => !!d);
    return dates.length ? dates.sort()[0] : today;
  }, [today]);

  const start = range === 'all' ? (earliest && earliest < today ? earliest : addDays(today, -6)) : addDays(today, -(Number(range) - 1));
  const dates = useMemo(() => dateRange(start, today), [start, today]);
  const weekly = dates.length > 45;
  const metrics = useRangeMetrics(start, today);
  const profile = useProfile();
  const events = useXpEvents();
  const quests = useQuests();
  const player = usePlayer(today);
  const weights = useWeights();
  const { weightUnit } = useSettings();

  const avgs = useMemo(() => (metrics ? periodAverages(dates, metrics) : null), [metrics, dates]);

  /** Group dates into chart buckets: days, or Monday-start weeks for long ranges. */
  const buckets = useMemo(() => {
    if (!weekly) return dates.map((d) => ({ key: d, label: dates.length <= 7 ? formatWeekday(d) : formatShortDate(d), days: [d] }));
    const map = new Map<string, DateKey[]>();
    for (const d of dates) {
      const w = startOfWeek(d);
      map.set(w, [...(map.get(w) ?? []), d]);
    }
    return [...map.entries()].map(([w, days]) => ({ key: w, label: formatShortDate(w), days }));
  }, [dates, weekly]);

  const calorieData = useMemo(() => {
    if (!metrics) return [];
    return buckets.map((b) => {
      const logged = b.days.map((d) => metrics.get(d)).filter((m): m is DayMetrics => !!m && m.entries > 0);
      const kcal = logged.length ? logged.reduce((s, m) => s + m.totals.energy.value, 0) / logged.length : null;
      return { ...b, kcal: kcal === null ? null : Math.round(kcal), logged: logged.length };
    });
  }, [buckets, metrics]);

  const dailyQuestCount = quests?.filter((q) => q.category === 'daily' && q.recurrence === 'daily').length ?? 0;
  const questData = useMemo(() => {
    const evs = events ?? [];
    return buckets.map((b) => {
      const done = evs.filter((e) => e.kind === 'quest' && e.category === 'daily' && b.days.includes(e.date)).length;
      const possible = dailyQuestCount * b.days.length;
      return { ...b, pct: possible ? Math.min(100, Math.round((done / possible) * 100)) : 0, done };
    });
  }, [buckets, events, dailyQuestCount]);

  const xpData = useMemo(() => {
    const evs = events ?? [];
    const before = evs.filter((e) => e.date < start).reduce((s, e) => s + e.xp, 0);
    const byDate = new Map<string, number>();
    for (const e of evs) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.xp);
    const out: { date: DateKey; label: string; xp: number }[] = [];
    for (const d of dates) {
      const prev = out.length ? out[out.length - 1].xp : before;
      out.push({ date: d, label: dates.length <= 7 ? formatWeekday(d) : formatShortDate(d), xp: prev + (byDate.get(d) ?? 0) });
    }
    return out;
  }, [events, dates, start]);

  const consistency = useMemo(() => {
    if (!metrics) return [];
    // Last 8 weeks (or fewer for short ranges): days with food logged per week.
    const weeks: { label: string; days: number; key: string }[] = [];
    const last = startOfWeek(today);
    for (let i = 7; i >= 0; i--) {
      const w = addDays(last, -7 * i);
      if (w < startOfWeek(start)) continue;
      const days = dateRange(w, addDays(w, 6)).filter((d) => d <= today && metrics.get(d)?.entries);
      weeks.push({ key: w, label: formatShortDate(w), days: days.length });
    }
    return weeks;
  }, [metrics, start, today]);

  const totalQuestRate = questData.length ? Math.round(questData.reduce((s, q) => s + q.pct, 0) / questData.length) : 0;
  const weightsInRange = (weights ?? []).filter((w) => w.date >= start);
  const weightChange = weightsInRange.length > 1 ? weightsInRange[weightsInRange.length - 1].kg - weightsInRange[0].kg : null;
  const t = profile.targets;
  const rangeDays = diffDays(start, today) + 1;

  return (
    <Page>
      <PageHeader back kicker="War room" title="Statistics" />
      <Segmented
        className="mb-4"
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
          { value: 'all', label: 'All time' },
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Tile label="Avg calories" value={avgs?.calories != null ? Math.round(avgs.calories).toLocaleString() : '—'} sub={`target ${t.calories.toLocaleString()} kcal`} />
        <Tile label="Avg protein" value={avgs?.protein != null ? `${Math.round(avgs.protein)} g` : '—'} sub={`target ${t.protein} g`} />
        <Tile label="Avg carbs" value={avgs?.carbs != null ? `${Math.round(avgs.carbs)} g` : '—'} sub={`target ${t.carbs} g`} />
        <Tile label="Avg fat" value={avgs?.fat != null ? `${Math.round(avgs.fat)} g` : '—'} sub={`target ${t.fat} g`} />
        <Tile label="Avg water" value={avgs?.water != null ? formatVolume(avgs.water) : '—'} sub={`goal ${formatVolume(t.waterMl)}`} />
        <Tile label="Days logged" value={`${avgs?.loggedDays ?? 0}/${rangeDays}`} sub="averages use logged days only" />
        <Tile label="Quest rate" value={`${totalQuestRate}%`} sub="daily missions completed" />
        <Tile
          label="Streak"
          value={
            <span className="flex items-center gap-1">
              <Flame size={18} className="text-orange" />
              {player?.streak.current ?? 0}d
            </span>
          }
          sub={`best ${plural(player?.streak.best ?? 0, 'day')}`}
        />
      </div>

      <Card className="mb-4">
        <SectionTitle>{weekly ? 'Calories · weekly average' : 'Calories per day'}</SectionTitle>
        <ChartBox label="Calories over time">
          <BarChart data={calorieData} margin={{ top: 8, right: 4, bottom: 0, left: -6 }} barCategoryGap="20%">
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
            <ReferenceLine y={t.calories} ifOverflow="extendDomain" stroke="var(--muted)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ fill: 'var(--surface-3)', opacity: 0.5 }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as (typeof calorieData)[number] | undefined;
                if (!active || !r) return null;
                return (
                  <TooltipCard
                    title={weekly ? `Week of ${r.label}` : formatShortDate(r.key)}
                    rows={[
                      { label: weekly ? 'Avg kcal' : 'kcal', value: r.kcal == null ? 'Not logged' : r.kcal.toLocaleString(), color: 'var(--gold)' },
                      ...(weekly ? [{ label: 'Days logged', value: String(r.logged) }] : []),
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="kcal" fill="var(--gold)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
        <Legend items={[{ label: 'Calories', color: 'var(--gold)' }, { label: 'Target', color: 'var(--muted)', dashed: true }]} />
      </Card>

      <Card className="mb-4">
        <SectionTitle>Daily missions completed</SectionTitle>
        <ChartBox label="Daily mission completion rate">
          <BarChart data={questData} margin={{ top: 8, right: 4, bottom: 0, left: -14 }} barCategoryGap="20%">
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
            <Tooltip
              cursor={{ fill: 'var(--surface-3)', opacity: 0.5 }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as (typeof questData)[number] | undefined;
                if (!active || !r) return null;
                return <TooltipCard title={weekly ? `Week of ${r.label}` : formatShortDate(r.key)} rows={[{ label: 'Completed', value: `${r.pct}% (${r.done})`, color: 'var(--success)' }]} />;
              }}
            />
            <Bar dataKey="pct" fill="var(--success)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
      </Card>

      <Card className="mb-4">
        <SectionTitle>XP progression</SectionTitle>
        <ChartBox label="Total XP over time">
          <AreaChart data={xpData} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
            <defs>
              <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--violet)" stopOpacity={0.35} />
                <stop offset="1" stopColor="var(--violet)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)' }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as (typeof xpData)[number] | undefined;
                if (!active || !r) return null;
                return <TooltipCard title={formatShortDate(r.date)} rows={[{ label: 'Total XP', value: r.xp.toLocaleString(), color: 'var(--violet)' }]} />;
              }}
            />
            <Area type="monotone" dataKey="xp" stroke="var(--violet)" strokeWidth={2} fill="url(#xpFill)" />
          </AreaChart>
        </ChartBox>
      </Card>

      <Card className="mb-4">
        <SectionTitle>Weekly consistency</SectionTitle>
        <p className="mb-2 text-xs text-muted">Days with food logged in each week (Monday start).</p>
        <div className="flex items-end gap-2">
          {consistency.map((w) => (
            <div key={w.key} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end rounded-lg bg-surface-3/60">
                <div className="w-full rounded-lg bg-gradient-to-t from-primary-2 to-cyan" style={{ height: `${(w.days / 7) * 100}%`, minHeight: w.days ? 4 : 0 }} title={`${w.days}/7 days`} />
              </div>
              <span className="tabular text-xs font-semibold">{w.days}/7</span>
              <span className="text-[10px] text-faint">{w.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Link to="/profile/weight" className="block">
        <Card className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="hud-label !text-[10px]">Weight trend</div>
            <div className="font-hud tabular text-xl font-bold">
              {weightChange === null ? 'Not enough weigh-ins' : `${weightChange < 0 ? '−' : weightChange > 0 ? '+' : '±'}${formatWeight(Math.abs(weightChange), weightUnit)}`}
            </div>
            <div className="text-xs text-muted">{plural(weightsInRange.length, 'weigh-in')} in this period</div>
          </div>
          <ChevronRight size={18} className="text-faint" />
        </Card>
      </Link>
    </Page>
  );
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  return (
    <Card className="!p-3.5">
      <div className="hud-label !text-[10px]">{label}</div>
      <div className="font-hud tabular mt-0.5 text-2xl font-bold leading-tight">{value}</div>
      <div className="truncate text-[11px] text-faint">{sub}</div>
    </Card>
  );
}

function ChartBox({ children, label }: { children: ReactElement; label: string }) {
  return (
    <div className="h-48" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
