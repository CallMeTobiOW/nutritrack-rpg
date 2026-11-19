/**
 * Better choices: higher-rated products from the same Open Food Facts
 * category (e.g. other breakfast cereals), preferring ones sold in the UK.
 */
import type { Food } from './models';
import { healthScore, type HealthScore } from './healthScore';
import { searchCategory } from './openFoodFacts';

type NewFood = Omit<Food, 'id'>;

export interface Alternative {
  food: NewFood;
  rating: HealthScore;
}

/** A suggestion must beat the current product clearly and be decent in its own right. */
export const MIN_GAIN = 10;
export const MIN_SCORE = 55;

/** Pick the best few candidates that beat `current`. Pure, for testing. */
export function pickBetter(food: Pick<Food, 'barcode' | 'unit'>, current: number, candidates: NewFood[], n = 3): Alternative[] {
  const seen = new Set<string>();
  const out: Alternative[] = [];
  for (const c of candidates) {
    if (c.barcode && c.barcode === food.barcode) continue;
    if (c.unit !== food.unit) continue;
    const key = `${c.name.toLowerCase()}|${(c.brand ?? '').toLowerCase()}`;
    if (seen.has(key)) continue;
    const rating = healthScore(c);
    if (!rating || rating.score < Math.max(current + MIN_GAIN, MIN_SCORE)) continue;
    seen.add(key);
    out.push({ food: c, rating });
  }
  // Best first; the search order (popularity) breaks ties.
  return out.sort((a, b) => b.rating.score - a.rating.score).slice(0, n);
}

const cache = new Map<string, Alternative[]>();

/**
 * Search the product's most specific categories, UK first, then worldwide,
 * until three better products are found.
 */
export async function findBetterAlternatives(food: Pick<Food, 'barcode' | 'unit' | 'quality'>, current: number, signal?: AbortSignal): Promise<Alternative[]> {
  const cats = [...(food.quality?.categories ?? [])].reverse().slice(0, 2);
  if (cats.length === 0) return [];
  const key = `${food.barcode ?? ''}|${cats.join(',')}|${current}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pool: NewFood[] = [];
  let best: Alternative[] = [];
  outer: for (const country of ['en:united-kingdom', null]) {
    for (const cat of cats) {
      pool.push(...(await searchCategory(cat, { country, signal })));
      best = pickBetter(food, current, pool);
      if (best.length >= 3) break outer;
    }
  }
  cache.set(key, best);
  return best;
}
