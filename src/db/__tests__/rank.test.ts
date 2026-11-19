import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { addDiaryEntry, addWater, deleteDiaryEntry, ensureInitialized, updateTargets } from '../actions';
import { createBackup, restoreBackup, wipeAllData } from '../backup';
import { syncProgression } from '../progression';
import { addDays, fromDateKey } from '../../lib/dates';
import { replayMatches } from '../../lib/rank';
import type { Food } from '../../lib/models';

const day1 = '2026-11-10';
const food: Food = {
  id: 'meal',
  name: 'Balanced meal',
  source: 'custom',
  unit: 'g',
  per100: { energy: 100, protein: 10, carbs: 10, fat: 3, fiber: 3 },
  servings: [],
  favorite: false,
  useCount: 0,
  createdAt: 0,
  updatedAt: 0,
};

/** Move the clock to noon on a local day; app mutations sync against "today". */
function setToday(d: string) {
  vi.setSystemTime(new Date(fromDateKey(d).getTime() + 12 * 3600_000));
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  setToday(day1);
  await db.delete();
  await db.open();
  await ensureInitialized();
  await syncProgression({ silent: true });
  // Targets that 2000 g of the meal above hits exactly: 2000 kcal, 200 g protein, 200 g carbs, 60 g fat, 60 g fibre.
  await updateTargets({ calories: 2000, protein: 200, carbs: 200, fat: 60, fiber: 60, waterMl: 2000 });
});

afterEach(() => {
  vi.useRealTimers();
});

async function logPerfectDay(date: string) {
  for (const meal of ['breakfast', 'lunch', 'dinner'] as const) await addDiaryEntry({ date, meal, food, amount: 700 }) // 2100 kcal, 210 g protein;
  await addWater(date, 2000);
}

describe('rank season', () => {
  it('starts the season on the first sync and locks nothing yet', async () => {
    const s = await db.settings.get('settings');
    expect(s?.rankSeasonStart).toBe(day1);
    expect(s?.rankSeenStep).toBe(-1);
    expect(await db.rankMatches.count()).toBe(0);
  });

  it('locks a day at the end of the following day, scoring its goals', async () => {
    await logPerfectDay(day1);
    setToday(addDays(day1, 1));
    await syncProgression({ silent: true });
    expect(await db.rankMatches.count()).toBe(0); // yesterday is still editable

    setToday(addDays(day1, 2));
    await syncProgression({ silent: true });
    const rows = await db.rankMatches.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: day1, score: 100 });
    expect(rows[0].goals).toHaveLength(6);
  });

  it('never rewrites a locked day', async () => {
    const e = await addDiaryEntry({ date: day1, meal: 'lunch', food, amount: 100 });
    setToday(addDays(day1, 2));
    await syncProgression({ silent: true });
    const before = (await db.rankMatches.get(day1))!;
    await deleteDiaryEntry(e.id);
    await logPerfectDay(day1); // back-filling an old day to farm rank
    await updateTargets({ calories: 2100 });
    expect(await db.rankMatches.get(day1)).toEqual(before);
  });

  it('locks unlogged days as defeats after an absence', async () => {
    setToday(addDays(day1, 10));
    await syncProgression({ silent: true });
    const rows = await db.rankMatches.toArray();
    expect(rows).toHaveLength(9);
    expect(rows.every((r) => r.score === 0)).toBe(true);
    const { state } = replayMatches(rows);
    expect(state.placed).toBe(true);
    expect(state.rating).toBe(0);
  });

  it('places after five locked days', async () => {
    for (let i = 0; i < 5; i++) {
      setToday(addDays(day1, i));
      await logPerfectDay(addDays(day1, i));
    }
    setToday(addDays(day1, 6));
    await syncProgression({ silent: true });
    const { state, outcomes } = replayMatches(await db.rankMatches.toArray());
    expect(outcomes).toHaveLength(5);
    expect(outcomes[4].change).toBe('placed');
    expect(state.rating).toBe(1999);
  });

  it('survives backup and restore, and a wipe starts a new season', async () => {
    setToday(addDays(day1, 4));
    await syncProgression({ silent: true });
    const backup = JSON.parse(JSON.stringify(await createBackup()));
    await wipeAllData();
    setToday(addDays(day1, 5));
    await syncProgression({ silent: true });
    expect(await db.rankMatches.count()).toBe(0);
    expect((await db.settings.get('settings'))?.rankSeasonStart).toBe(addDays(day1, 5));
    await restoreBackup(backup);
    // Restored season resumes; day 4 now also locks.
    expect((await db.rankMatches.toArray()).map((r) => r.date)).toEqual([day1, addDays(day1, 1), addDays(day1, 2), addDays(day1, 3)]);
  });
});

describe('badges', () => {
  const badgeRows = async () => (await db.xpEvents.toArray()).filter((e) => e.kind === 'badge');

  it('pays each badge step once, from locked days only, and never twice', async () => {
    for (let i = 0; i < 4; i++) await logPerfectDay(addDays(day1, i));
    // Nothing is locked yet, so no badge XP.
    expect(await badgeRows()).toHaveLength(0);

    setToday(addDays(day1, 5));
    await syncProgression({ silent: true });
    const locked = await db.rankMatches.toArray();
    expect(locked).toHaveLength(4);
    expect(locked[0].entries).toBe(3);

    const rows = await badgeRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.find((r) => r.id === 'badge:iron-will:1')).toMatchObject({ refId: 'iron-will', xp: 5, title: 'Iron Will: Bronze 4' });
    // Every badge was won on all four days, so every badge pays the same steps.
    const perBadge = new Set(rows.map((r) => r.refId));
    expect(perBadge.size).toBe(9);

    // Missed days lower the rating but never take paid XP back, and re-syncing pays nothing new.
    setToday(addDays(day1, 12));
    await syncProgression({ silent: true });
    await syncProgression({ silent: true });
    const after = await badgeRows();
    expect(after.map((r) => r.id).sort()).toEqual(rows.map((r) => r.id).sort());
  });

  it('editing a locked day changes nothing', async () => {
    await logPerfectDay(day1);
    await logPerfectDay(addDays(day1, 1));
    setToday(addDays(day1, 3));
    await syncProgression({ silent: true });
    const before = await badgeRows();
    expect(before.length).toBeGreaterThan(0);
    for (const e of await db.diary.toArray()) await deleteDiaryEntry(e.id);
    await syncProgression({ silent: true });
    expect(await badgeRows()).toEqual(before);
  });
});
