import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import {
  addDiaryEntry,
  addWater,
  createQuest,
  deleteDiaryEntry,
  deleteWater,
  deleteWeight,
  ensureInitialized,
  logWeight,
  saveProfile,
  toggleQuest,
  updateDiaryEntry,
  updateTargets,
  updateWeight,
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

  it('range-checks edited weigh-ins and refuses to overwrite another day', async () => {
    await logWeight('2026-11-01', 82);
    await logWeight('2026-11-15', 81);
    const [nov1] = await db.weights.where('date').equals('2026-11-01').toArray();
    await expect(updateWeight(nov1.id, { kg: 0.5 })).rejects.toThrow(/out of range/);
    await expect(updateWeight(nov1.id, { date: '2026-11-15' })).rejects.toThrow(/already a weigh-in/);
    expect(await db.weights.count()).toBe(2);
    expect((await db.weights.get(nov1.id))?.kg).toBe(82);
  });

  it('keeps the profile weight and targets in step when weigh-ins are edited or deleted', async () => {
    await saveProfile({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', objective: 'maintain' }, { onboard: true });
    await logWeight('2026-11-10', 80);
    await logWeight(today, 90);
    expect((await db.profile.get('me'))?.weightKg).toBe(90);
    const latest = (await db.weights.where('date').equals(today).first())!;
    await updateWeight(latest.id, { kg: 85 });
    expect((await db.profile.get('me'))?.weightKg).toBe(85);
    await deleteWeight(latest.id);
    const p = await db.profile.get('me');
    expect(p?.weightKg).toBe(80);
    expect(p?.targets.protein).toBe(128); // 1.6 g/kg × 80
  });

  it('drops an out-of-range goal weight', async () => {
    await saveProfile({ goalWeightKg: 75 });
    expect((await db.profile.get('me'))?.goalWeightKg).toBe(75);
    await saveProfile({ goalWeightKg: 1 });
    expect((await db.profile.get('me'))?.goalWeightKg).toBeUndefined();
  });

  it('keeps calorie targets automatic when only the water goal is changed', async () => {
    await saveProfile({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', objective: 'maintain' }, { onboard: true });
    await updateTargets({ waterMl: 3000 });
    await logWeight(today, 60);
    const p = await db.profile.get('me');
    expect(p?.customTargets).toBe(false);
    expect(p?.targets.protein).toBe(96); // follows the new weight
    expect(p?.targets.waterMl).toBe(3000); // the chosen water goal is kept
  });
});

describe('level-ups', () => {
  it('celebrates a level only the first time it is reached', async () => {
    const q = await createQuest({ title: 'Big one', category: 'side', recurrence: 'daily', xp: 100, icon: 'star' });
    const levels = () => getCelebrations().filter((c) => c.item.kind === 'level').length;
    await toggleQuest(q.id, today);
    expect(levels()).toBe(1);
    getCelebrations().forEach((c) => dismissCelebration(c.key));
    await toggleQuest(q.id, today); // untick: back below the level
    await toggleQuest(q.id, today); // tick again
    expect(levels()).toBe(0);
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
