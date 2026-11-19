/** Food helpers shared by the diary, search and portion screens. */
import type { Food, FoodSnapshot, MealSlot } from './models';
import { NUTRIENTS, type NutrientValues } from './nutrients';
import { scaleNutrients } from './nutrition';

/**
 * Sanity-check per-100 values for a custom food. Returns a message for the
 * first problem found, or null. Pure fat is 900 kcal per 100 g, so nothing
 * real goes higher; dense liquids (syrups) can hold a little over 100 g of
 * solids per 100 ml, so liquids get more headroom on gram values.
 */
export function per100Problem(per100: NutrientValues, unit: 'g' | 'ml'): string | null {
  const energy = per100.energy;
  if (energy !== undefined && energy > 900) return `Calories look too high: nothing has more than 900 kcal per 100 ${unit}.`;
  const maxGrams = unit === 'ml' ? 150 : 100;
  for (const k of ['protein', 'carbs', 'sugar', 'fat', 'satFat', 'fiber'] as const) {
    const v = per100[k];
    if (v !== undefined && v > maxGrams) return `${NUTRIENTS[k].label} cannot be more than ${maxGrams} g per 100 ${unit}.`;
  }
  const mass = (per100.protein ?? 0) + (per100.carbs ?? 0) + (per100.fat ?? 0) + (per100.fiber ?? 0);
  if (mass > maxGrams + 1) return `Protein, carbs, fat and fibre add up to more than ${maxGrams} g per 100 ${unit}. Check the values or the serving size.`;
  // Small tolerance for labels that round each figure separately.
  if (per100.sugar !== undefined && per100.carbs !== undefined && per100.sugar > per100.carbs + 0.5) return 'Sugars are part of carbohydrate, so they cannot be higher than it.';
  if (per100.satFat !== undefined && per100.fat !== undefined && per100.satFat > per100.fat + 0.5) return 'Saturates are part of fat, so they cannot be higher than it.';
  return null;
}

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

/**
 * Which portion option and quantity to show first. With a previous amount
 * (editing an entry, or re-logging a food) the same portion comes back;
 * otherwise the label's first serving, else 100 g/ml.
 */
export function presetPortion(options: PortionOption[], amount?: number, servingLabel?: string): { key: string; qty: number } {
  if (amount !== undefined && amount > 0) {
    const match = servingLabel ? options.find((o) => !o.raw && servingLabel.includes(o.label)) : undefined;
    if (match) return { key: match.key, qty: round(amount / match.amount, 2) };
    return { key: 'raw', qty: round(amount, 1) };
  }
  if (options.length > 1) return { key: options[1].key, qty: 1 };
  return { key: 'raw', qty: 100 };
}

/** The portion to use without asking: the last one logged, else the first serving, else 100 g/ml. */
export function defaultPortion(food: Pick<Food, 'unit' | 'servings' | 'lastAmount' | 'lastServingLabel'>): { amount: number; servingLabel?: string } {
  const options = portionOptions(food);
  const p = presetPortion(options, food.lastAmount, food.lastServingLabel);
  const option = options.find((o) => o.key === p.key) ?? options[0];
  return { amount: round(p.qty * option.amount, 1), servingLabel: servingText(option, p.qty, food.unit) };
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
  const label = labelStatesAmount(option.label, option.amount, unit) ? option.label : `${option.label} (${round(option.amount)} ${unit})`;
  return q === 1 ? label : `${q} × ${label}`;
}

/** True when a serving label already names this amount as a whole number with its unit ("1 slice (15 g)" states 15 g, not 5 g). */
function labelStatesAmount(label: string, amount: number, unit: string): boolean {
  const n = String(round(amount)).replace('.', '\\.');
  const u = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\d.,])${n}\\s*${u}(?![a-z])`, 'i').test(label);
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
