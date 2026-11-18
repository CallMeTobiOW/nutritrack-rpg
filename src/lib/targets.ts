/**
 * Target estimation. Every number produced here is an ESTIMATE and is shown
 * to the player as such; all of them can be overridden in Profile.
 *
 * Energy:  Mifflin-St Jeor resting energy × activity factor.
 * Protein: g per kg of body weight, depending on objective (ISSN position
 *          stand range 1.4–2.0 g/kg for active people).
 * Fat:     ~30 % of energy (within the 20–35 % AMDR).
 * Carbs:   the remaining energy.
 * Fibre:   14 g per 1000 kcal (Dietary Guidelines for Americans).
 * Sat fat: < 10 % of energy (WHO / DGA) — a limit.
 * Sugar:   ~10 % of energy as a soft limit. Open Food Facts reports TOTAL
 *          sugars, so this is a guide rather than the WHO "free sugars" rule.
 * Water:   EFSA adequate TOTAL water intake (drinks + food) is 2.0 L (female)
 *          / 2.5 L (male). We use it as a simple drinking goal; adjust freely.
 *
 * Safety rails: weight-loss deficits are capped at 500 kcal and 20 % of
 * maintenance, and never go below 1500 kcal (male) / 1200 kcal (female).
 */
import { MICRO_KEYS, type NutrientKey } from './nutrients';
import { referenceIntake, type Sex } from './references';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type Objective = 'lose' | 'maintain' | 'build';

export const ACTIVITY_LEVELS: Record<ActivityLevel, { label: string; factor: number; hint: string }> = {
  sedentary: { label: 'Sedentary', factor: 1.2, hint: 'Desk job, little exercise' },
  light: { label: 'Lightly active', factor: 1.375, hint: 'Exercise 1–3 days a week' },
  moderate: { label: 'Moderately active', factor: 1.55, hint: 'Exercise 3–5 days a week' },
  active: { label: 'Very active', factor: 1.725, hint: 'Hard exercise 6–7 days a week' },
  veryActive: { label: 'Extremely active', factor: 1.9, hint: 'Physical job plus training' },
};

export const OBJECTIVES: Record<Objective, { label: string; hint: string }> = {
  lose: { label: 'Lose weight', hint: 'A moderate, sustainable deficit' },
  maintain: { label: 'Maintain weight', hint: 'Fuel at maintenance' },
  build: { label: 'Build muscle', hint: 'A small surplus with high protein' },
};

export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

export interface BodyStats {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  objective: Objective;
}

export interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  satFat: number;
  waterMl: number;
}

export function bmrMifflin({ sex, age, heightCm, weightKg }: Pick<BodyStats, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function tdee(stats: BodyStats): number {
  return bmrMifflin(stats) * ACTIVITY_LEVELS[stats.activity].factor;
}

export function calorieTarget(stats: BodyStats): number {
  const maintenance = tdee(stats);
  let kcal = maintenance;
  if (stats.objective === 'lose') {
    const deficit = Math.min(500, maintenance * 0.2);
    // Never below the safety floor, and never above maintenance.
    kcal = Math.min(maintenance, Math.max(maintenance - deficit, CALORIE_FLOOR[stats.sex]));
  } else if (stats.objective === 'build') {
    kcal = maintenance + Math.min(300, maintenance * 0.1);
  }
  return Math.round(kcal / 10) * 10;
}

const PROTEIN_G_PER_KG: Record<Objective, number> = { lose: 1.8, maintain: 1.6, build: 1.8 };

export function suggestTargets(stats: BodyStats): Targets {
  const calories = calorieTarget(stats);
  const protein = Math.round(stats.weightKg * PROTEIN_G_PER_KG[stats.objective]);
  const fat = Math.round((calories * 0.3) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: Math.round((calories / 1000) * 14),
    sugar: Math.round((calories * 0.1) / 4),
    satFat: Math.round((calories * 0.1) / 9),
    waterMl: stats.sex === 'male' ? 2500 : 2000,
  };
}

/** Default targets used before a profile has been completed. */
export const DEFAULT_TARGETS: Targets = {
  calories: 2200,
  protein: 130,
  carbs: 240,
  fat: 73,
  fiber: 31,
  sugar: 55,
  satFat: 24,
  waterMl: 2000,
};

export function suggestMicroTargets(sex: Sex, age: number): Partial<Record<NutrientKey, number>> {
  const out: Partial<Record<NutrientKey, number>> = {};
  for (const key of MICRO_KEYS) out[key] = referenceIntake(key, sex, age);
  return out;
}

/** Warn when a manual calorie target goes below the safety floor. */
export function isBelowCalorieFloor(calories: number, sex: Sex): boolean {
  return calories < CALORIE_FLOOR[sex];
}
