import { describe, expect, it } from 'vitest';
import { bmrMifflin, calorieTarget, suggestMicroTargets, suggestTargets, tdee, type BodyStats } from '../targets';
import { referenceIntake } from '../references';

const male: BodyStats = { sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', objective: 'maintain' };
const female: BodyStats = { sex: 'female', age: 28, heightCm: 165, weightKg: 60, activity: 'light', objective: 'maintain' };

describe('energy equations', () => {
  it('matches Mifflin-St Jeor', () => {
    // 10·80 + 6.25·180 − 5·30 + 5 = 1780
    expect(bmrMifflin(male)).toBe(1780);
    // 10·60 + 6.25·165 − 5·28 − 161 = 1330.25
    expect(bmrMifflin(female)).toBeCloseTo(1330.25);
  });

  it('applies the activity factor', () => {
    expect(tdee(male)).toBeCloseTo(1780 * 1.55);
  });

  it('uses a moderate deficit for weight loss, capped at 500 kcal', () => {
    const maintain = tdee(male); // 2759
    expect(calorieTarget({ ...male, objective: 'lose' })).toBe(Math.round((maintain - 500) / 10) * 10);
  });

  it('caps the deficit at 20% for smaller bodies', () => {
    const small: BodyStats = { ...female, activity: 'sedentary', objective: 'lose' };
    const m = tdee(small); // ~1596
    expect(calorieTarget(small)).toBe(Math.round(Math.max(m * 0.8, 1200) / 10) * 10);
  });

  it('never goes below the safety floor or above maintenance when losing', () => {
    const tiny: BodyStats = { sex: 'female', age: 70, heightCm: 145, weightKg: 42, activity: 'sedentary', objective: 'lose' };
    const kcal = calorieTarget(tiny);
    expect(kcal).toBeLessThanOrEqual(Math.round(tdee(tiny) / 10) * 10);
    const male2: BodyStats = { ...male, weightKg: 50, heightCm: 150, age: 80, activity: 'sedentary', objective: 'lose' };
    expect(calorieTarget(male2)).toBeGreaterThanOrEqual(Math.min(1500, Math.round(tdee(male2) / 10) * 10));
  });

  it('uses a small surplus when building muscle', () => {
    const t = calorieTarget({ ...male, objective: 'build' });
    expect(t - tdee(male)).toBeGreaterThan(200);
    expect(t - tdee(male)).toBeLessThanOrEqual(305);
  });
});

describe('macro suggestions', () => {
  it('splits calories sensibly and the macros add up', () => {
    const t = suggestTargets(male);
    expect(t.protein).toBe(128); // 1.6 g/kg
    const kcalFromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    expect(Math.abs(kcalFromMacros - t.calories)).toBeLessThan(15);
    expect(t.fat * 9 / t.calories).toBeCloseTo(0.3, 1);
    expect(t.fiber).toBe(Math.round((t.calories / 1000) * 14));
    expect(t.waterMl).toBe(2500);
  });

  it('raises protein when losing weight', () => {
    expect(suggestTargets({ ...male, objective: 'lose' }).protein).toBe(144);
  });
});

describe('micronutrient references', () => {
  it('returns DRI values by sex and age', () => {
    expect(referenceIntake('iron', 'female', 30)).toBe(18);
    expect(referenceIntake('iron', 'female', 55)).toBe(8);
    expect(referenceIntake('iron', 'male', 30)).toBe(8);
    expect(referenceIntake('magnesium', 'male', 25)).toBe(400);
    expect(referenceIntake('magnesium', 'male', 35)).toBe(420);
    expect(referenceIntake('vitD', 'male', 75)).toBe(20);
    expect(referenceIntake('calcium', 'female', 55)).toBe(1200);
    expect(referenceIntake('vitC', 'male', 30)).toBe(90);
    expect(referenceIntake('sodium', 'male', 30)).toBe(2300);
  });

  it('suggests a value for every micronutrient', () => {
    const m = suggestMicroTargets('female', 30);
    expect(Object.keys(m)).toHaveLength(24);
    expect(Object.values(m).every((v) => (v ?? 0) > 0)).toBe(true);
  });
});
