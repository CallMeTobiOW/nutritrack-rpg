/**
 * Data checks for a food's nutrition values, so a wrong database entry is
 * flagged before it quietly skews the day's totals.
 */
import type { FoodQuality } from './models';
import type { NutrientValues } from './nutrients';
import { per100Problem } from './food';

export type IssueLevel = 'missing' | 'suspect';

export interface QualityIssue {
  level: IssueLevel;
  text: string;
}

/** kcal the macros account for (Atwater factors; fibre counted at 2 kcal/g where known). */
export function kcalFromMacros(v: NutrientValues): number | undefined {
  if (v.protein === undefined || v.carbs === undefined || v.fat === undefined) return undefined;
  return v.protein * 4 + v.carbs * 4 + v.fat * 9 + (v.fiber ?? 0) * 2;
}

/**
 * True when the stated calories and the macros disagree by more than label
 * rounding, fibre/alcohol/polyol differences can explain: over 30 kcal and
 * over 25% per 100 g.
 */
export function energyMismatch(v: NutrientValues): { stated: number; fromMacros: number } | null {
  const est = kcalFromMacros(v);
  if (v.energy === undefined || est === undefined) return null;
  const diff = Math.abs(v.energy - est);
  if (diff <= 30 || diff <= 0.25 * Math.max(v.energy, est)) return null;
  return { stated: Math.round(v.energy), fromMacros: Math.round(est) };
}

export function qualityIssues(food: { per100: NutrientValues; unit: 'g' | 'ml'; quality?: FoodQuality }): QualityIssue[] {
  const v = food.per100;
  const out: QualityIssue[] = [];
  if (v.energy === undefined) out.push({ level: 'missing', text: 'No calories listed. It will log as 0 kcal until the values are added.' });
  const missing = (['protein', 'carbs', 'fat'] as const).filter((k) => v[k] === undefined);
  if (v.energy !== undefined && missing.length) {
    const names = { protein: 'protein', carbs: 'carbs', fat: 'fat' };
    out.push({ level: 'missing', text: `No ${missing.map((k) => names[k]).join(', ')} listed, so macro totals will be low.` });
  }
  const problem = per100Problem(v, food.unit);
  if (problem) out.push({ level: 'suspect', text: problem });
  const mismatch = (food.quality?.alcohol ?? 0) > 0.5 ? null : energyMismatch(v);
  if (!problem && mismatch) {
    out.push({
      level: 'suspect',
      text: `Calories don't match the macros: the label says ${mismatch.stated} kcal per 100 ${food.unit}, the macros add up to about ${mismatch.fromMacros}. Check against the pack.`,
    });
  }
  if (food.quality?.incomplete && out.length === 0) out.push({ level: 'missing', text: 'Open Food Facts marks this entry as incomplete. Check it against the pack.' });
  return out;
}
