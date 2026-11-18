/**
 * Pure nutrition maths: scaling per-100 values to an eaten amount and
 * totalling a list of entries while keeping track of missing data.
 */
import { NUTRIENT_KEYS, type NutrientKey, type NutrientValues } from './nutrients';

export type MeasureUnit = 'g' | 'ml';

/** Values for `amount` g/ml of a food whose values are given per 100 g/ml. */
export function scaleNutrients(per100: NutrientValues, amount: number): NutrientValues {
  const out: NutrientValues = {};
  if (!Number.isFinite(amount) || amount < 0) return out;
  for (const key of NUTRIENT_KEYS) {
    const v = per100[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = (v * amount) / 100;
  }
  return out;
}

export interface NutrientTotal {
  /** Sum of the values that ARE known. */
  value: number;
  /** Number of contributing items that had this nutrient. */
  known: number;
  /** Number of contributing items missing this nutrient. */
  unknown: number;
}

export type NutrientTotals = Record<NutrientKey, NutrientTotal>;

export function emptyTotals(): NutrientTotals {
  const t = {} as NutrientTotals;
  for (const key of NUTRIENT_KEYS) t[key] = { value: 0, known: 0, unknown: 0 };
  return t;
}

/** Sum already-scaled nutrient values, counting unknowns per nutrient. */
export function sumNutrients(items: NutrientValues[]): NutrientTotals {
  const totals = emptyTotals();
  for (const item of items) {
    for (const key of NUTRIENT_KEYS) {
      const v = item[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        totals[key].value += v;
        totals[key].known += 1;
      } else {
        totals[key].unknown += 1;
      }
    }
  }
  return totals;
}

/**
 * Completeness of a total:
 *  - 'none'     nothing logged
 *  - 'unknown'  items logged but none report this nutrient
 *  - 'partial'  some items are missing it (the total is a minimum)
 *  - 'complete' every item reports it
 */
export type Completeness = 'none' | 'unknown' | 'partial' | 'complete';

export function completeness(t: NutrientTotal): Completeness {
  if (t.known === 0 && t.unknown === 0) return 'none';
  if (t.known === 0) return 'unknown';
  if (t.unknown > 0) return 'partial';
  return 'complete';
}

export interface ProgressInfo {
  consumed: number;
  target: number;
  remaining: number;
  /** 0..∞ ratio of consumed to target. */
  ratio: number;
  percent: number;
}

export function progress(consumed: number, target: number): ProgressInfo {
  const safeTarget = target > 0 ? target : 0;
  const ratio = safeTarget > 0 ? consumed / safeTarget : 0;
  return {
    consumed,
    target: safeTarget,
    remaining: safeTarget - consumed,
    ratio,
    percent: Math.round(ratio * 100),
  };
}

/** Atwater estimate (kcal) — used only to sanity-check, never to fill gaps. */
export function atwaterKcal(v: NutrientValues): number | null {
  if (v.protein == null || v.carbs == null || v.fat == null) return null;
  return v.protein * 4 + v.carbs * 4 + v.fat * 9;
}

export function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
