/** Input limits shared by forms and the data layer. */
export const LIMITS = {
  questXp: { min: 5, max: 200 },
  bonusXp: { min: 0, max: 200 },
  questTitle: 120,
  foodName: 120,
  amount: { min: 0.1, max: 5000 }, // g / ml per entry
  waterMl: { min: 10, max: 5000 },
  weightKg: { min: 25, max: 350 },
  heightCm: { min: 100, max: 250 },
  age: { min: 13, max: 100 },
  calories: { min: 800, max: 8000 },
  waterGoalMl: { min: 500, max: 6000 },
  targetGrams: { min: 0, max: 1000 }, // macro, fibre, sugar and sat-fat targets
} as const;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
