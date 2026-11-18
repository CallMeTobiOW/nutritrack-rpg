/**
 * Aggregations over history: per-day metrics, lifetime player stats and
 * averages for the statistics screen. Pure functions only.
 */
import { toWeekKey, type DateKey } from './dates';
import type { DiaryEntry, Food, Quest, WaterEntry, WeightEntry, XpEvent } from './models';
import { computeDayMetrics, goalFlags, type DayMetrics } from './quests';
import type { PlayerStats } from './achievements';
import { computeStreak } from './streaks';
import { levelFromXp } from './xp';
import type { Targets } from './targets';

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/** Metrics for every date in `dates`, computed efficiently from grouped data. */
export function dayMetricsFor(
  dates: DateKey[],
  diary: DiaryEntry[],
  water: WaterEntry[],
  weights: WeightEntry[],
): Map<DateKey, DayMetrics> {
  const d = groupBy(diary, (e) => e.date);
  const w = groupBy(water, (e) => e.date);
  const wt = groupBy(weights, (e) => e.date);
  const out = new Map<DateKey, DayMetrics>();
  for (const date of dates) {
    out.set(date, computeDayMetrics(date, d.get(date) ?? [], w.get(date) ?? [], wt.get(date) ?? []));
  }
  return out;
}

export function activeDays(
  diary: Pick<DiaryEntry, 'date'>[],
  water: Pick<WaterEntry, 'date'>[],
  events: Pick<XpEvent, 'date' | 'kind'>[],
): Set<DateKey> {
  const s = new Set<DateKey>();
  for (const e of diary) s.add(e.date);
  for (const e of water) s.add(e.date);
  for (const e of events) if (e.kind === 'quest') s.add(e.date);
  return s;
}

export function totalXp(events: Iterable<XpEvent>): number {
  let t = 0;
  for (const e of events) t += e.xp;
  return t;
}

export interface StatsInput {
  diary: DiaryEntry[];
  water: WaterEntry[];
  weights: WeightEntry[];
  events: XpEvent[];
  foods: Food[];
  quests: Quest[];
  targets: Targets;
  today: DateKey;
}

export function computePlayerStats(i: StatsInput): PlayerStats {
  const dates = new Set<DateKey>([...i.diary.map((e) => e.date), ...i.water.map((e) => e.date)]);
  const metrics = dayMetricsFor([...dates], i.diary, i.water, i.weights);
  let waterGoalDays = 0;
  let proteinGoalDays = 0;
  let macroGoalDays = 0;
  for (const m of metrics.values()) {
    const g = goalFlags(m, i.targets);
    if (g.water) waterGoalDays++;
    if (g.protein) proteinGoalDays++;
    if (g.macros) macroGoalDays++;
  }

  const questEvents = i.events.filter((e) => e.kind === 'quest');
  const weeklyQuestIds = i.quests.filter((q) => q.recurrence === 'weekly').map((q) => q.id);
  const weeklyByWeek = groupBy(
    questEvents.filter((e) => weeklyQuestIds.includes(e.refId)),
    (e) => e.period,
  );
  let weeklyClears = 0;
  for (const evs of weeklyByWeek.values()) {
    const ids = new Set(evs.map((e) => e.refId));
    if (weeklyQuestIds.length > 0 && weeklyQuestIds.every((id) => ids.has(id))) weeklyClears++;
  }

  return {
    questsCompleted: questEvents.length,
    dailyMissionsCompleted: questEvents.filter((e) => e.category === 'daily').length,
    fullClearDays: i.events.filter((e) => e.kind === 'bonus').length,
    weeklyClears,
    bestStreak: computeStreak(activeDays(i.diary, i.water, i.events), i.today).best,
    waterGoalDays,
    proteinGoalDays,
    macroGoalDays,
    daysLogged: new Set(i.diary.map((e) => e.date)).size,
    foodsLogged: i.diary.length,
    weighIns: i.weights.length,
    scannedFoods: i.foods.filter((f) => f.scanned).length,
    level: levelFromXp(totalXp(i.events)).level,
  };
}

export interface PeriodAverages {
  days: number;
  loggedDays: number;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  water: number | null;
}

/** Averages over days that have data (unlogged days are excluded, not counted as zero). */
export function periodAverages(dates: DateKey[], metrics: Map<DateKey, DayMetrics>): PeriodAverages {
  const logged = dates.map((d) => metrics.get(d)).filter((m): m is DayMetrics => !!m && m.entries > 0);
  const watered = dates.map((d) => metrics.get(d)).filter((m): m is DayMetrics => !!m && m.waterMl > 0);
  const avg = (arr: DayMetrics[], f: (m: DayMetrics) => number) =>
    arr.length ? arr.reduce((s, m) => s + f(m), 0) / arr.length : null;
  return {
    days: dates.length,
    loggedDays: logged.length,
    calories: avg(logged, (m) => m.totals.energy.value),
    protein: avg(logged, (m) => m.totals.protein.value),
    carbs: avg(logged, (m) => m.totals.carbs.value),
    fat: avg(logged, (m) => m.totals.fat.value),
    water: avg(watered, (m) => m.waterMl),
  };
}

/** Average of weights per ISO week. */
export function weeklyWeightAverages(weights: WeightEntry[]): { week: string; kg: number; count: number }[] {
  const by = groupBy(weights, (w) => toWeekKey(w.date));
  return [...by.entries()]
    .map(([week, ws]) => ({ week, kg: ws.reduce((s, w) => s + w.kg, 0) / ws.length, count: ws.length }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/** Simple moving average used to smooth the weight chart. */
export function movingAverage(values: (number | null)[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v != null);
    return slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : null;
  });
}
