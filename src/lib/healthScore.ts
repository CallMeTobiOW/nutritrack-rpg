/**
 * Health rating, 0–100: how good a food is for you per 100 g / 100 ml.
 *
 * Built to be explained, not just shown. Every point gained or lost comes
 * from one named reason:
 *  - Sugar, saturated fat, salt and fat use the UK Food Standards Agency
 *    front-of-pack traffic-light limits (separate limits for drinks).
 *  - Sugary drinks lose extra points above the UK Soft Drinks Industry Levy
 *    bands (5 g and 8 g of sugar per 100 ml).
 *  - Fibre and protein earn points at the UK/EU "source of" and "high in"
 *    claim levels; fruit, veg and nuts earn points when Open Food Facts can
 *    estimate them.
 *  - Ultra-processing (NOVA 4) and additives of concern (see additives.ts)
 *    cost points.
 * Every food starts at 70 ("nothing wrong, nothing special").
 */
import type { FoodQuality } from './models';
import type { NutrientValues } from './nutrients';
import { ADDITIVES, additiveInfo, type AdditiveConcern } from './additives';

export const BASE_SCORE = 70;

export interface ScoreReason {
  /** Points added (positive) or removed (negative). */
  points: number;
  text: string;
  /** Longer explanation, e.g. why an additive is flagged. */
  detail?: string;
}

export type ScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'bad';

export interface HealthScore {
  score: number;
  band: ScoreBand;
  /** Worst first. */
  minuses: ScoreReason[];
  /** Best first. */
  pluses: ScoreReason[];
  /** False when ingredients (processing, additives) were not available. */
  ingredientsChecked: boolean;
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  bad: 'Bad',
};

export const BAND_COLOR: Record<ScoreBand, string> = {
  excellent: '#10b981',
  good: '#84cc16',
  fair: '#eab308',
  poor: '#f97316',
  bad: '#ef4444',
};

export function bandFor(score: number): ScoreBand {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'poor';
  return 'bad';
}

/** FSA traffic-light limits per 100 g (food) or 100 ml (drinks): [amber from, red above]. */
const LIGHTS = {
  food: { sugar: [5, 22.5], satFat: [1.5, 5], salt: [0.3, 1.5], fat: [3, 17.5] },
  drink: { sugar: [2.5, 11.25], satFat: [0.75, 2.5], salt: [0.3, 0.75], fat: [1.5, 8.75] },
} as const;

const PENALTY = {
  sugar: { amber: 8, red: 16, label: 'sugar' },
  satFat: { amber: 7, red: 14, label: 'saturated fat' },
  salt: { amber: 6, red: 14, label: 'salt' },
  fat: { amber: 3, red: 6, label: 'fat' },
} as const;

const ADDITIVE_POINTS: Record<AdditiveConcern, number> = { high: 10, moderate: 4, low: 2 };

const fmt = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

/**
 * Rate a food. Returns null when there is too little nutrition data to be
 * fair (fewer than three of energy, sugar, fat/sat fat and salt known).
 */
export function healthScore(food: { per100: NutrientValues; unit: 'g' | 'ml'; quality?: FoodQuality }): HealthScore | null {
  const v = food.per100;
  const q = food.quality;
  const known = [v.energy, v.sugar, v.satFat ?? v.fat, v.sodium].filter((x) => x !== undefined).length;
  if (known < 3) return null;

  const drink = food.unit === 'ml';
  const per = drink ? '100 ml' : '100 g';
  const lights = drink ? LIGHTS.drink : LIGHTS.food;
  const minuses: ScoreReason[] = [];
  const pluses: ScoreReason[] = [];
  const salt = v.sodium === undefined ? undefined : v.sodium / 400; // mg sodium → g salt

  // Nutrients to limit.
  const amounts = { sugar: v.sugar, satFat: v.satFat, salt, fat: v.fat };
  for (const key of ['sugar', 'satFat', 'salt', 'fat'] as const) {
    const amount = amounts[key];
    if (amount === undefined) continue;
    // Fat only counts when saturates are unknown or it is high on its own.
    const [amber, red] = lights[key];
    const p = PENALTY[key];
    if (amount > red) minuses.push({ points: -p.red, text: `High in ${p.label}: ${fmt(amount)} g per ${per}` });
    else if (amount > amber && key !== 'fat') minuses.push({ points: -p.amber, text: `Medium ${p.label}: ${fmt(amount)} g per ${per}` });
    else if (amount > amber && key === 'fat' && v.satFat === undefined) minuses.push({ points: -p.amber, text: `Medium fat: ${fmt(amount)} g per ${per}` });
  }
  if (drink && v.sugar !== undefined && v.sugar >= 5) {
    minuses.push({
      points: v.sugar >= 8 ? -16 : -10,
      text: `Sugary drink: ${fmt(v.sugar)} g sugar per 100 ml`,
      detail: `Above the UK sugar tax ${v.sugar >= 8 ? 'higher' : 'lower'} band (${v.sugar >= 8 ? 8 : 5} g per 100 ml). Liquid sugar doesn't fill you up.`,
    });
  }
  if (!drink && v.energy !== undefined && v.energy > 400 && (v.sugar ?? 0) + (v.satFat ?? 0) > 20) {
    minuses.push({ points: -6, text: `Calorie dense: ${Math.round(v.energy)} kcal per 100 g, mostly from sugar and fat` });
  }

  // Good stuff.
  if (v.fiber !== undefined && v.fiber >= 3) pluses.push({ points: v.fiber >= 6 ? 8 : 4, text: `${v.fiber >= 6 ? 'High in' : 'Source of'} fibre: ${fmt(v.fiber)} g per ${per}` });
  if (v.protein !== undefined && v.energy !== undefined && v.energy > 0) {
    const share = (v.protein * 4) / v.energy;
    if (share >= 0.12 && v.protein >= 1) {
      pluses.push({ points: share >= 0.2 ? 8 : 4, text: `${share >= 0.2 ? 'High in' : 'Source of'} protein: ${Math.round(share * 100)}% of its calories` });
    }
  }
  if (q?.fruitVeg !== undefined && q.fruitVeg >= 40) {
    pluses.push({ points: q.fruitVeg >= 80 ? 10 : 5, text: `About ${Math.round(q.fruitVeg)}% fruit, veg, pulses or nuts` });
  }

  // Processing and additives.
  const why = q?.markers?.length ? ` Found: ${q.markers.join(', ')}.` : '';
  if (q?.nova === 4) {
    minuses.push({
      points: -12,
      text: q.novaEstimated ? 'Ultra-processed (from its ingredients)' : 'Ultra-processed (NOVA 4)',
      detail: `Made with industrial ingredients you wouldn't cook with at home.${why} Diets high in ultra-processed food are linked to weight gain and heart disease.`,
    });
  }
  else if (q?.nova === 3) minuses.push({ points: -4, text: 'Processed (NOVA 3)' });
  else if (q?.nova === 1) pluses.push({ points: 5, text: 'Unprocessed or minimally processed (NOVA 1)' });

  if (q?.additives) {
    const flagged = q.additives
      .map((c) => ({ code: c, info: additiveInfo(c) }))
      .filter((a): a is { code: string; info: NonNullable<ReturnType<typeof additiveInfo>> } => !!a.info)
      .sort((a, b) => ADDITIVE_POINTS[b.info.concern] - ADDITIVE_POINTS[a.info.concern]);
    for (const { info } of flagged) {
      minuses.push({ points: -ADDITIVE_POINTS[info.concern], text: info.name, detail: info.why });
    }
    if (q.additives.length >= 5) {
      minuses.push({ points: -4, text: `${q.additives.length} additives in total` });
    }
  }

  const total = [...minuses, ...pluses].reduce((s, r) => s + r.points, BASE_SCORE);
  const score = Math.max(0, Math.min(100, Math.round(total)));
  return {
    score,
    band: bandFor(score),
    minuses: minuses.sort((a, b) => a.points - b.points),
    pluses: pluses.sort((a, b) => b.points - a.points),
    ingredientsChecked: !!q && (q.additives !== undefined || q.nova !== undefined),
  };
}

/** Number of additive entries known, for tests and docs. */
export const KNOWN_ADDITIVES = Object.keys(ADDITIVES).length;
