/** Food helpers shared by the diary, search and portion screens. */
import type { Food, FoodSnapshot, MealSlot } from './models';
import type { NutrientValues } from './nutrients';
import { scaleNutrients } from './nutrition';

/** Guess the meal slot from the time of day. */
export function mealForTime(d: Date = new Date()): MealSlot {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snacks';
}

export function isMealSlot(v: string | null | undefined): v is MealSlot {
  return v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snacks';
}

export interface PortionOption {
  key: string;
  label: string;
  /** g/ml per 1 unit of this option. 1 for the raw gram/ml option. */
  amount: number;
  raw: boolean;
}

export function portionOptions(food: Pick<FoodSnapshot, 'unit' | 'servings'>): PortionOption[] {
  return [
    { key: 'raw', label: food.unit, amount: 1, raw: true },
    ...food.servings.map((s, i) => ({ key: `s${i}`, label: s.label, amount: s.amount, raw: false })),
  ];
}

/** Human label for an eaten amount, e.g. "2 × 1 bar (45 g)" or "150 g". */
export function amountLabel(amount: number, unit: string, servingLabel?: string): string {
  const grams = `${round(amount)} ${unit}`;
  if (!servingLabel) return grams;
  // Avoid "45 g · 45 g" when the serving label already states the amount.
  const squash = (t: string) => t.replace(/\s+/g, '').toLowerCase();
  return squash(servingLabel).includes(squash(grams)) ? servingLabel : `${servingLabel} · ${grams}`;
}

export function servingText(option: PortionOption, qty: number, unit: string): string | undefined {
  if (option.raw) return undefined;
  const q = round(qty, 2);
  const label = option.label.includes(`${option.amount}`) ? option.label : `${option.label} (${round(option.amount)} ${unit})`;
  return q === 1 ? label : `${q} × ${label}`;
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function nutrientsFor(food: Pick<FoodSnapshot, 'per100'>, amount: number): NutrientValues {
  return scaleNutrients(food.per100, amount);
}

/** kcal for a default portion: first serving if any, else 100 g/ml. */
export function defaultPortionKcal(food: Pick<Food, 'per100' | 'servings' | 'unit'>): { kcal: number | undefined; label: string } {
  const s = food.servings[0];
  const amount = s?.amount ?? 100;
  const kcal = food.per100.energy === undefined ? undefined : (food.per100.energy * amount) / 100;
  return { kcal, label: s ? s.label : `100 ${food.unit}` };
}

export function matchesQuery(food: Pick<Food, 'name' | 'brand' | 'barcode'>, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [food.name, food.brand, food.barcode].some((v) => v?.toLowerCase().includes(needle));
}

/** "1 weigh-in", "3 weigh-ins", "1 diary entry", "2 diary entries". */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : pluralForm}`;
}
