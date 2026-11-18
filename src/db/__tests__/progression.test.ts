import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import {
  addDiaryEntry,
  addWater,
  createQuest,
  deleteDiaryEntry,
  deleteWater,
  ensureInitialized,
  logWeight,
  saveProfile,
  toggleQuest,
  updateDiaryEntry,
  updateTargets,
} from '../actions';
import { syncProgression } from '../progression';
import { bonusEventId, questEventId } from '../../lib/quests';
import { totalXp } from '../../lib/stats';
import { getCelebrations, dismissCelebration } from '../../lib/celebrations';
import type { Food } from '../../lib/models';

const today = '2026-11-17';
const food: Food = {
  id: 'oats',
  name: 'Oats',
  source: 'custom',
  unit: 'g',
  per100: { energy: 380, protein: 13, carbs: 60, fat: 7, fiber: 10 },
  servings: [{ label: '1 bowl', amount: 50 }],
  favorite: false,
  useCount: 0,
  createdAt: 0,
  updatedAt: 0,
};

async function xp() {
  return totalXp(await db.xpEvents.toArray());
}

async function questByTitle(title: string) {
  const q = (await db.quests.toArray()).find((x) => x.title === title);
  if (!q) throw new Error(`no quest ${title}`);
  return q;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureInitialized();
  getCelebrations().forEach((c) => dismissCelebration(c.key));
});

describe('initialisation', () => {
  it('seeds profile, settings and starter quests once', async () => {
    const n = await db.quests.count();
    expect(n).toBeGreaterThan(10);
    await ensureInitialized();
    expect(await db.quests.count()).toBe(n);
    expect((await db.profile.get('me'))?.onboarded).toBe(false);
  });
});

describe('manual quests and XP', () => {
  it('awards XP once, even when ticked repeatedly', async () => {
    const q = await questByTitle('Complete a workout');
    expect(await toggleQuest(q.id, today)).toBe(true);
    // First quest also unlocks "First Victory" (+25)
    expect(await xp()).toBe(30 + 25);
    expect(await toggleQuest(q.id, today)).toBe(false); // untick
    expect(await xp()).toBe(25); // quest XP removed, achievement stays
    await toggleQuest(q.id, today);
    await toggleQuest(q.id, today);
    await toggleQuest(q.id, today);
    expect(await xp()).toBe(30 + 25);
    expect(await db.xpEvents.where('kind').equals('quest').count()).toBe(1);
  });

  it('resets daily quests on a new day while keeping history', async () => {
    const q = await questByTitle('Go for a walk');
    await toggleQuest(q.id, today);
    await toggleQuest(q.id, '2026-11-18');
    expect(await db.xpEvents.get(questEventId(q.id, today))).toBeTruthy();
    expect(await db.xpEvents.get(questEventId(q.id, '2026-11-18'))).toBeTruthy();
  });

  it('cannot manually tick auto-tracked quests', async () => {
    const q = await questByTitle('Reach your water goal');
    expect(await toggleQuest(q.id, today)).toBe(false);
    expect(await db.xpEvents.get(questEventId(q.id, today))).toBeUndefined();
  });

  it('clamps custom quest XP', async () => {
    const q = await createQuest({ title: '  Meditate  ', category: 'side', recurrence: 'daily', xp: 99999, icon: 'star' });
    expect(q.xp).toBe(200);
    expect(q.title).toBe('Meditate');
  });
});

describe('auto quests react to tracked data', () => {
  it('completes and un-completes the water quest', async () => {
    const q = await questByTitle('Reach your water goal');
    await addWater(today, 1500);
    expect(await db.xpEvents.get(questEventId(q.id, today))).toBeUndefined();
    await addWater(today, 500);
    // syncs use the real clock; run one for the test date explicitly
    await syncProgression({ today });
    expect(await db.xpEvents.get(questEventId(q.id, today))).toBeTruthy();
    const w = await db.water.where('date').equals(today).first();
    await deleteWater(w!.id);
    await syncProgression({ today });
    expect(await db.xpEvents.get(questEventId(q.id, today))).toBeUndefined();
  });

  it('completes the protein quest from diary totals and respects edits', async () => {
    await updateTargets({ protein: 100 });
    const q = await questByTitle('Reach your protein target');
    const e = await addDiaryEntry({ date: today, meal: 'breakfast', food, amount: 800 }); // 104 g protein
    await syncProgression({ today });
    expect(await db.xpEvents.get(questEventId(q.id, today))).toBeTruthy();
    await updateDiaryEntry(e.id, { amount: 100 });
    await syncProgression({ today });
    expect(await db.xpEvents.get(questEventId(q.id, today))).toBeUndefined();
    await deleteDiaryEntry(e.id);
  });

  it('grants the all-daily-missions bonus exactly once', async () => {
    await updateTargets({ calories: 2000, protein: 50, waterMl: 2000 });
    // 3 meals, ~2000 kcal, plenty of protein
    for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
      await addDiaryEntry({ date: today, meal, food, amount: 175 }); // 665 kcal, 22.75 g protein each
    }
    await addWater(today, 2000);
    const veg = await questByTitle('Eat a portion of vegetables');
    await toggleQuest(veg.id, today);
    await syncProgression({ today });
    expect(await db.xpEvents.get(bonusEventId(today))).toBeTruthy();
    await syncProgression({ today });
    expect(await db.xpEvents.where('kind').equals('bonus').count()).toBe(1);
    expect(await db.achievements.get('full-clear')).toBeTruthy();
    // unticking a daily mission withdraws the bonus
    await toggleQuest(veg.id, today);
    expect(await db.xpEvents.get(bonusEventId(today))).toBeUndefined();
    expect(await db.achievements.get('full-clear')).toBeTruthy(); // achievements are permanent
  });
});

describe('profile and weight', () => {
  it('recalculates targets from the profile unless customised', async () => {
    await saveProfile({ name: 'Alex', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', objective: 'maintain' }, { onboard: true });
    const p = await db.profile.get('me');
    expect(p?.targets.protein).toBe(128);
    expect(p?.onboarded).toBe(true);
    await updateTargets({ protein: 150 });
    await saveProfile({ weightKg: 90 });
    expect((await db.profile.get('me'))?.targets.protein).toBe(150);
  });

  it('keeps one weigh-in per day and unlocks Baseline', async () => {
    await logWeight(today, 80);
    await logWeight(today, 79.6);
    const ws = await db.weights.toArray();
    expect(ws).toHaveLength(1);
    expect(ws[0].kg).toBe(79.6);
    expect(await db.achievements.get('baseline')).toBeTruthy();
    await expect(logWeight(today, 5)).rejects.toThrow();
  });
});

describe('diary validation', () => {
  it('rejects zero or negative amounts', async () => {
    await expect(addDiaryEntry({ date: today, meal: 'lunch', food, amount: 0 })).rejects.toThrow();
    await expect(addDiaryEntry({ date: today, meal: 'lunch', food, amount: -10 })).rejects.toThrow();
  });

  it('stores a snapshot so editing the food later does not change history', async () => {
    const e = await addDiaryEntry({ date: today, meal: 'lunch', food, amount: 50 });
    food.per100.energy = 999;
    const stored = await db.diary.get(e.id);
    expect(stored?.food.per100.energy).toBe(380);
    food.per100.energy = 380;
  });
});
