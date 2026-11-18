import { describe, expect, it } from 'vitest';
import type { DiaryEntry, Quest, XpEvent } from '../models';
import {
  autoRuleFits,
  boardProgress,
  bonusEventId,
  computeDayMetrics,
  goalFlags,
  isQuestVisible,
  makeQuestEvent,
  periodKey,
  questEventId,
  reconcileQuests,
  type AutoContext,
} from '../quests';
import { DEFAULT_TARGETS, type Targets } from '../targets';

const T: Targets = { ...DEFAULT_TARGETS, calories: 2000, protein: 100, carbs: 250, fat: 70, waterMl: 2000, fiber: 30 };
const today = '2026-11-17';

const quest = (over: Partial<Quest>): Quest => ({
  id: over.id ?? 'q',
  title: over.title ?? 'Quest',
  category: 'daily',
  recurrence: 'daily',
  xp: 20,
  icon: 'star',
  order: 0,
  createdAt: 0,
  ...over,
});

const entry = (meal: DiaryEntry['meal'], per100: DiaryEntry['food']['per100'], amount: number, date = today): DiaryEntry => ({
  id: Math.random().toString(),
  date,
  meal,
  amount,
  createdAt: 0,
  food: { name: 'x', unit: 'g', per100, servings: [] },
});

const ctxWith = (diary: DiaryEntry[], waterMl = 0, weekHasWeighIn = false): AutoContext => ({
  day: computeDayMetrics(today, diary, waterMl ? [{ id: 'w', date: today, ml: waterMl, createdAt: 0 }] : [], []),
  weekHasWeighIn,
  targets: T,
});

describe('periods', () => {
  it('derives period keys from recurrence', () => {
    expect(periodKey({ recurrence: 'daily' }, today)).toBe(today);
    expect(periodKey({ recurrence: 'weekly' }, today)).toBe('2026-W47');
    expect(periodKey({ recurrence: 'once' }, today)).toBe('once');
  });

  it('resets daily quests on the next local day', () => {
    const q = quest({ id: 'a' });
    const ev = makeQuestEvent(q, today, 0);
    expect(ev.id).toBe(questEventId('a', today));
    const ids = new Set([ev.id]);
    expect(ids.has(questEventId('a', periodKey(q, today)))).toBe(true);
    expect(ids.has(questEventId('a', periodKey(q, '2026-11-18')))).toBe(false);
  });

  it('keeps weekly quests complete for the whole week', () => {
    const q = quest({ id: 'w', recurrence: 'weekly', category: 'weekly' });
    const ev = makeQuestEvent(q, '2026-11-16', 0);
    expect(questEventId('w', periodKey(q, '2026-11-22'))).toBe(ev.id);
    expect(questEventId('w', periodKey(q, '2026-11-23'))).not.toBe(ev.id);
  });

  it('hides one-time quests after the day they were completed', () => {
    const q = quest({ id: 'o', recurrence: 'once', category: 'bonus' });
    const events = new Map<string, XpEvent>();
    expect(isQuestVisible(q, today, events)).toBe(true);
    const ev = makeQuestEvent(q, today, 0);
    events.set(ev.id, ev);
    expect(isQuestVisible(q, today, events)).toBe(true);
    expect(isQuestVisible(q, '2026-11-18', events)).toBe(false);
  });
});

describe('goal flags', () => {
  it('requires a calorie RANGE, so under-eating never counts', () => {
    const low = computeDayMetrics(today, [entry('lunch', { energy: 100 }, 500)], [], []); // 500 kcal
    expect(goalFlags(low, T).calorieRange).toBe(false);
    const ok = computeDayMetrics(today, [entry('lunch', { energy: 100 }, 1900)], [], []); // 1900 kcal
    expect(goalFlags(ok, T).calorieRange).toBe(true);
    const high = computeDayMetrics(today, [entry('lunch', { energy: 100 }, 2300)], [], []);
    expect(goalFlags(high, T).calorieRange).toBe(false);
  });

  it('checks main meals', () => {
    const m = computeDayMetrics(today, [entry('breakfast', {}, 1), entry('lunch', {}, 1)], [], []);
    expect(goalFlags(m, T).logMeals).toBe(false);
    const m2 = computeDayMetrics(today, [entry('breakfast', {}, 1), entry('lunch', {}, 1), entry('dinner', {}, 1)], [], []);
    expect(goalFlags(m2, T).logMeals).toBe(true);
  });

  it('checks macro balance', () => {
    const m = computeDayMetrics(today, [entry('lunch', { protein: 10, carbs: 25, fat: 7 }, 1000)], [], []);
    expect(goalFlags(m, T).macros).toBe(true);
    const m2 = computeDayMetrics(today, [entry('lunch', { protein: 10, carbs: 25, fat: 20 }, 1000)], [], []);
    expect(goalFlags(m2, T).macros).toBe(false);
  });
});

describe('reconcileQuests', () => {
  const water = quest({ id: 'water', auto: 'water' });
  const veg = quest({ id: 'veg' });
  const weigh = quest({ id: 'weigh', auto: 'weighIn', recurrence: 'weekly', category: 'weekly' });

  it('completes an auto quest when its goal is reached', () => {
    const r = reconcileQuests([water], new Map(), ctxWith([], 2000), 50, 0);
    expect(r.add.map((e) => e.id)).toContain(questEventId('water', today));
  });

  it('withdraws an auto quest if the data no longer supports it', () => {
    const ev = makeQuestEvent(water, today, 0);
    const r = reconcileQuests([water], new Map([[ev.id, ev]]), ctxWith([], 1500), 50, 0);
    expect(r.remove).toContain(ev.id);
  });

  it('ties auto rules to a repeat setting they make sense for', () => {
    expect(autoRuleFits('water', 'daily')).toBe(true);
    expect(autoRuleFits('water', 'once')).toBe(true);
    expect(autoRuleFits('water', 'weekly')).toBe(false);
    expect(autoRuleFits('weighIn', 'weekly')).toBe(true);
    expect(autoRuleFits('weighIn', 'once')).toBe(true);
    expect(autoRuleFits('weighIn', 'daily')).toBe(false);
  });

  it('ignores a weekly quest with a day-based rule, so its XP does not flip each new day', () => {
    const weeklyWater = quest({ id: 'ww', auto: 'water', recurrence: 'weekly', category: 'weekly' });
    expect(reconcileQuests([weeklyWater], new Map(), ctxWith([], 2500), 0, 0).add).toEqual([]);
    const ev = makeQuestEvent(weeklyWater, today, 0);
    expect(reconcileQuests([weeklyWater], new Map([[ev.id, ev]]), ctxWith([], 10), 0, 0).remove).toEqual([]);
  });

  it('does not pay a daily weigh-in quest every day from one weekly weigh-in', () => {
    const dailyWeigh = quest({ id: 'dw', auto: 'weighIn' });
    expect(reconcileQuests([dailyWeigh], new Map(), ctxWith([], 0, true), 0, 0).add).toEqual([]);
  });

  it('is idempotent: no duplicate XP on repeated syncs', () => {
    const r1 = reconcileQuests([water], new Map(), ctxWith([], 2500), 0, 0);
    const events = new Map(r1.add.map((e) => [e.id, e]));
    const r2 = reconcileQuests([water], events, ctxWith([], 2500), 0, 0);
    expect(r2.add).toEqual([]);
    expect(r2.remove).toEqual([]);
  });

  it('grants the all-daily bonus only when every daily mission is done, and withdraws it', () => {
    const vegEv = makeQuestEvent(veg, today, 0);
    const events = new Map([[vegEv.id, vegEv]]);
    const r = reconcileQuests([water, veg, weigh], events, ctxWith([], 2000), 50, 0);
    const bonus = r.add.find((e) => e.id === bonusEventId(today));
    expect(bonus?.xp).toBe(50);

    for (const e of r.add) events.set(e.id, e);
    events.delete(vegEv.id); // player unticks the vegetables quest
    const r2 = reconcileQuests([water, veg, weigh], events, ctxWith([], 2000), 50, 0);
    expect(r2.remove).toContain(bonusEventId(today));
  });

  it('ignores side quests for the bonus', () => {
    const side = quest({ id: 'side', category: 'side' });
    const r = reconcileQuests([water, side], new Map(), ctxWith([], 2000), 50, 0);
    expect(r.add.some((e) => e.kind === 'bonus')).toBe(true);
  });

  it('tracks weekly weigh-ins', () => {
    const r = reconcileQuests([weigh], new Map(), ctxWith([], 0, true), 50, 0);
    expect(r.add[0].id).toBe(questEventId('weigh', '2026-W47'));
  });

  it('never rewrites past days', () => {
    const past = makeQuestEvent(water, '2026-11-16', 0);
    const r = reconcileQuests([water], new Map([[past.id, past]]), ctxWith([], 0), 50, 0);
    expect(r.remove).not.toContain(past.id);
  });
});

describe('boardProgress', () => {
  it('reports completion percentage of visible quests', () => {
    const a = quest({ id: 'a' });
    const b = quest({ id: 'b' });
    const ev = makeQuestEvent(a, today, 0);
    expect(boardProgress([a, b], today, new Map([[ev.id, ev]]))).toEqual({ total: 2, completed: 1, percent: 50 });
  });
});
