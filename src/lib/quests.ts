/**
 * Quest rules: periods, visibility, auto-tracking and XP reconciliation.
 * Everything here is pure so it can be unit tested without a database.
 */
import { toWeekKey, type DateKey } from './dates';
import type { DiaryEntry, MealSlot, Quest, WaterEntry, WeightEntry, XpEvent } from './models';
import { scaleNutrients, sumNutrients, type NutrientTotals } from './nutrition';
import type { Targets } from './targets';

export const CATEGORY_META = {
  daily: { label: 'Daily Missions', hint: 'Core objectives. Clear them all for a bonus.' },
  side: { label: 'Side Quests', hint: 'Optional missions that build a stronger you.' },
  weekly: { label: 'Weekly Objectives', hint: 'Resets every Monday.' },
  bonus: { label: 'Bonus Challenges', hint: 'One-time feats.' },
} as const;

export const AUTO_RULE_META = {
  water: { label: 'Reach your water goal' },
  protein: { label: 'Reach your protein target' },
  logMeals: { label: 'Log breakfast, lunch and dinner' },
  calorieRange: { label: 'Finish within ±10% of your calorie target' },
  weighIn: { label: 'Log a weight entry this week' },
  fiber: { label: 'Reach your fibre target' },
} as const;

export function periodKey(quest: Pick<Quest, 'recurrence'>, date: DateKey): string {
  if (quest.recurrence === 'daily') return date;
  if (quest.recurrence === 'weekly') return toWeekKey(date);
  return 'once';
}

export function questEventId(questId: string, period: string): string {
  return `quest:${questId}:${period}`;
}

export function bonusEventId(date: DateKey): string {
  return `bonus:allDaily:${date}`;
}

export function achievementEventId(achievementId: string): string {
  return `ach:${achievementId}`;
}

export interface DayMetrics {
  date: DateKey;
  entries: number;
  meals: Record<MealSlot, number>;
  totals: NutrientTotals;
  waterMl: number;
  weighedIn: boolean;
}

export function computeDayMetrics(
  date: DateKey,
  diary: DiaryEntry[],
  water: WaterEntry[],
  weights: WeightEntry[],
): DayMetrics {
  const dayDiary = diary.filter((e) => e.date === date);
  const meals: Record<MealSlot, number> = { breakfast: 0, lunch: 0, dinner: 0, snacks: 0 };
  for (const e of dayDiary) meals[e.meal] += 1;
  return {
    date,
    entries: dayDiary.length,
    meals,
    totals: sumNutrients(dayDiary.map((e) => scaleNutrients(e.food.per100, e.amount))),
    waterMl: water.filter((w) => w.date === date).reduce((s, w) => s + w.ml, 0),
    weighedIn: weights.some((w) => w.date === date),
  };
}

export interface GoalFlags {
  water: boolean;
  protein: boolean;
  calorieRange: boolean;
  macros: boolean;
  fiber: boolean;
  logMeals: boolean;
}

/**
 * Daily goal checks. The calorie and macro checks are RANGES on purpose:
 * eating far below target never counts as success.
 */
export function goalFlags(m: DayMetrics, t: Targets): GoalFlags {
  const kcal = m.totals.energy.value;
  const within = (v: number, target: number, lo: number, hi: number) => target > 0 && v >= target * lo && v <= target * hi;
  return {
    water: t.waterMl > 0 && m.waterMl >= t.waterMl,
    protein: t.protein > 0 && m.totals.protein.value >= t.protein,
    calorieRange: m.entries > 0 && within(kcal, t.calories, 0.9, 1.1),
    macros:
      t.protein > 0 &&
      m.totals.protein.value >= t.protein * 0.95 &&
      within(m.totals.carbs.value, t.carbs, 0.85, 1.15) &&
      within(m.totals.fat.value, t.fat, 0.85, 1.15),
    fiber: t.fiber > 0 && m.totals.fiber.value >= t.fiber,
    logMeals: m.meals.breakfast > 0 && m.meals.lunch > 0 && m.meals.dinner > 0,
  };
}

export interface AutoContext {
  day: DayMetrics;
  weekHasWeighIn: boolean;
  targets: Targets;
}

export function evaluateAuto(rule: NonNullable<Quest['auto']>, ctx: AutoContext): boolean {
  if (rule === 'weighIn') return ctx.weekHasWeighIn;
  return goalFlags(ctx.day, ctx.targets)[rule];
}

export function isQuestComplete(quest: Quest, date: DateKey, eventIds: Set<string>): boolean {
  return eventIds.has(questEventId(quest.id, periodKey(quest, date)));
}

/** One-time quests stay on the board until completed, then for the rest of that day. */
export function isQuestVisible(quest: Quest, date: DateKey, events: Map<string, XpEvent>): boolean {
  if (quest.recurrence !== 'once') return true;
  const ev = events.get(questEventId(quest.id, 'once'));
  return !ev || ev.date === date;
}

export function makeQuestEvent(quest: Quest, date: DateKey, now: number): XpEvent {
  const period = periodKey(quest, date);
  return {
    id: questEventId(quest.id, period),
    kind: 'quest',
    refId: quest.id,
    period,
    date,
    xp: quest.xp,
    title: quest.title,
    category: quest.category,
    createdAt: now,
  };
}

export interface ReconcileResult {
  add: XpEvent[];
  remove: string[];
}

/**
 * Bring the ledger in line with today's data:
 *  - auto quests are completed / un-completed for the CURRENT period only
 *    (history is never rewritten);
 *  - the "all daily missions" bonus is granted or withdrawn for today.
 */
export function reconcileQuests(
  quests: Quest[],
  events: Map<string, XpEvent>,
  ctx: AutoContext,
  bonusXp: number,
  now: number,
): ReconcileResult {
  const today = ctx.day.date;
  const add: XpEvent[] = [];
  const remove: string[] = [];
  const done = new Set(events.keys());

  for (const q of quests) {
    if (!q.auto) continue;
    if (!isQuestVisible(q, today, events)) continue;
    const id = questEventId(q.id, periodKey(q, today));
    const shouldBeDone = evaluateAuto(q.auto, ctx);
    if (shouldBeDone && !done.has(id)) {
      add.push(makeQuestEvent(q, today, now));
      done.add(id);
    } else if (!shouldBeDone && done.has(id)) {
      remove.push(id);
      done.delete(id);
    }
  }

  const dailyMissions = quests.filter((q) => q.category === 'daily' && q.recurrence === 'daily');
  const allDone = dailyMissions.length > 0 && dailyMissions.every((q) => done.has(questEventId(q.id, today)));
  const bonusId = bonusEventId(today);
  if (allDone && !done.has(bonusId) && bonusXp > 0) {
    add.push({
      id: bonusId,
      kind: 'bonus',
      refId: 'allDaily',
      period: today,
      date: today,
      xp: bonusXp,
      title: 'All daily missions complete',
      createdAt: now,
    });
  } else if (!allDone && done.has(bonusId)) {
    remove.push(bonusId);
  }

  return { add, remove };
}

export interface BoardProgress {
  total: number;
  completed: number;
  percent: number;
}

export function boardProgress(quests: Quest[], date: DateKey, events: Map<string, XpEvent>): BoardProgress {
  const visible = quests.filter((q) => isQuestVisible(q, date, events));
  const ids = new Set(events.keys());
  const completed = visible.filter((q) => isQuestComplete(q, date, ids)).length;
  return {
    total: visible.length,
    completed,
    percent: visible.length ? Math.round((completed / visible.length) * 100) : 0,
  };
}
