import { describe, expect, it } from 'vitest';
import { BASE_SCORE, bandFor, healthScore } from '../healthScore';
import { additiveCode, additiveInfo } from '../additives';
import { pickBetter } from '../alternatives';
import type { Food, FoodQuality } from '../models';
import type { NutrientValues } from '../nutrients';

// Per 100 g/ml, sodium in mg (salt × 400).
const food = (per100: NutrientValues, quality?: FoodQuality, unit: 'g' | 'ml' = 'g') => ({ per100, unit, quality });
const oats = food({ energy: 375, protein: 11, carbs: 60, sugar: 1, fat: 8, satFat: 1.4, fiber: 9, sodium: 4 }, { nova: 1, additives: [] });
const beans = food({ energy: 78, protein: 4.7, carbs: 12.5, sugar: 4.7, fat: 0.2, satFat: 0.1, fiber: 3.7, sodium: 240 }, { nova: 3, additives: [], fruitVeg: 50 });
const cola = food({ energy: 42, protein: 0, carbs: 10.6, sugar: 10.6, fat: 0, satFat: 0, sodium: 4 }, { nova: 4, additives: ['e150d', 'e338'] }, 'ml');
const dietCola = food({ energy: 0.4, protein: 0, carbs: 0, sugar: 0, fat: 0, satFat: 0, sodium: 8 }, { nova: 4, additives: ['e150d', 'e338', 'e951', 'e950', 'e330'] }, 'ml');
const sweets = food({ energy: 345, protein: 4.6, carbs: 80, sugar: 56, fat: 0.2, satFat: 0.1, sodium: 40 }, { nova: 4, additives: ['e129', 'e102', 'e110', 'e133', 'e330'] });
const caramelBar = food({ energy: 449, protein: 4, carbs: 69, sugar: 60, fat: 17, satFat: 8.4, sodium: 150 }, { nova: 4, additives: ['e322', 'e471'] });
const water = food({ energy: 0, protein: 0, carbs: 0, sugar: 0, fat: 0, satFat: 0, sodium: 1 }, { nova: 1, additives: [] }, 'ml');

describe('healthScore', () => {
  const score = (f: ReturnType<typeof food>) => healthScore(f)!.score;

  it('ranks everyday foods in a sensible order', () => {
    expect(score(oats)).toBeGreaterThanOrEqual(80);
    expect(score(beans)).toBeGreaterThanOrEqual(70);
    expect(score(water)).toBeGreaterThanOrEqual(70);
    expect(score(dietCola)).toBeLessThan(55);
    expect(score(cola)).toBeLessThan(35);
    expect(score(caramelBar)).toBeLessThan(20);
    expect(score(sweets)).toBeLessThan(20);
    expect(score(oats)).toBeGreaterThan(score(beans));
    expect(score(dietCola)).toBeGreaterThan(score(cola));
  });

  it('explains each point and adds up exactly', () => {
    const r = healthScore(beans)!;
    const total = BASE_SCORE + [...r.minuses, ...r.pluses].reduce((s, x) => s + x.points, 0);
    expect(r.score).toBe(Math.max(0, Math.min(100, total)));
    expect(r.minuses.map((m) => m.text)).toEqual(['Medium salt: 0.6 g per 100 g', 'Processed (NOVA 3)']);
    expect(r.pluses.map((m) => m.text)).toEqual(['High in protein: 24% of its calories', 'About 50% fruit, veg, pulses or nuts', 'Source of fibre: 3.7 g per 100 g']);
  });

  it('names every flagged food dye, worst first, with the UK warning', () => {
    const r = healthScore(sweets)!;
    const additives = r.minuses.filter((m) => m.text.includes('(E'));
    expect(additives.map((a) => a.text)).toEqual(['Allura red (E129)', 'Tartrazine (E102)', 'Sunset yellow (E110)', 'Brilliant blue (E133)']);
    expect(additives[0].detail).toMatch(/activity and attention in children/);
    expect(additives.reduce((s, a) => s + a.points, 0)).toBe(-32);
    expect(r.score).toBeLessThan(10);
    expect(r.minuses[0].points).toBe(-16); // sugar is the biggest single reason
  });

  it('uses the drink limits and the UK sugar-tax bands for drinks', () => {
    const r = healthScore(cola)!;
    expect(r.minuses.map((m) => m.text)).toContain('Sugary drink: 10.6 g sugar per 100 ml');
    expect(r.minuses.find((m) => m.text.startsWith('Sugary'))!.points).toBe(-16);
    const juice = healthScore(food({ energy: 25, sugar: 6, fat: 0, sodium: 0 }, undefined, 'ml'))!;
    expect(juice.minuses.find((m) => m.text.startsWith('Sugary'))!.points).toBe(-10);
  });

  it('flags sweeteners and caramel colour in diet drinks', () => {
    const texts = healthScore(dietCola)!.minuses.map((m) => m.text);
    expect(texts).toEqual(expect.arrayContaining(['Aspartame (E951)', 'Acesulfame K (E950)', 'Sulphite ammonia caramel (E150d)', '5 additives in total']));
  });

  it('says when ingredients were not checked, and refuses to rate without enough data', () => {
    expect(healthScore(food({ energy: 100, sugar: 1, fat: 1, sodium: 10 }))!.ingredientsChecked).toBe(false);
    expect(healthScore(oats)!.ingredientsChecked).toBe(true);
    expect(healthScore(food({ energy: 100, protein: 5 }))).toBeNull();
  });

  it('only counts total fat when saturates are unknown or fat is high', () => {
    expect(healthScore(food({ energy: 200, sugar: 1, fat: 10, satFat: 1, sodium: 10 }))!.minuses).toEqual([]);
    expect(healthScore(food({ energy: 200, sugar: 1, fat: 10, sodium: 10 }))!.minuses.map((m) => m.text)).toEqual(['Medium fat: 10 g per 100 g']);
  });

  it('bands', () => {
    expect([100, 80, 79, 60, 59, 40, 39, 20, 19, 0].map(bandFor)).toEqual(['excellent', 'excellent', 'good', 'good', 'fair', 'fair', 'poor', 'poor', 'bad', 'bad']);
  });
});

describe('additives', () => {
  it('reads Open Food Facts tags and falls back to the family', () => {
    expect(additiveCode('en:e150d')).toBe('e150d');
    expect(additiveCode('en:e322i')).toBe('e322i');
    expect(additiveCode('en:something')).toBeNull();
    expect(additiveInfo('e150d')?.name).toMatch(/E150d/);
    expect(additiveInfo('e450i')?.name).toMatch(/E450/);
    expect(additiveInfo('e330')).toBeUndefined(); // citric acid: neutral
  });
});

describe('pickBetter', () => {
  const mk = (name: string, per100: NutrientValues, extra: Partial<Food> = {}): Omit<Food, 'id'> => ({
    name, source: 'off', unit: 'g', per100, servings: [], favorite: false, useCount: 0, createdAt: 0, updatedAt: 0, quality: { nova: 3, additives: [] }, ...extra,
  });
  const good = mk('Oat bar', { energy: 380, protein: 9, sugar: 12, fat: 12, satFat: 1.2, fiber: 7, sodium: 40 });
  const meh = mk('Cereal bar', { energy: 400, protein: 5, sugar: 25, fat: 14, satFat: 6, sodium: 120 });
  const great = mk('Nut bar', { energy: 480, protein: 15, sugar: 4, fat: 30, satFat: 4, fiber: 8, sodium: 20 }, { quality: { nova: 1, additives: [] } });

  it('keeps clearly better products, best first, without duplicates or the same product', () => {
    const picked = pickBetter({ barcode: '1', unit: 'g' }, 10, [meh, good, good, great, { ...good, barcode: '1', name: 'Self' }]);
    expect(picked.map((p) => p.food.name)).toEqual(['Nut bar', 'Oat bar']);
    expect(picked.every((p) => p.rating.score >= 55)).toBe(true);
  });

  it('suggests nothing when nothing beats the current product by enough', () => {
    expect(pickBetter({ unit: 'g' }, 90, [good, great])).toEqual([]);
    expect(pickBetter({ unit: 'ml' }, 10, [good])).toEqual([]); // drinks only for drinks
  });
});

describe('findBetterAlternatives', () => {
  it('searches the most specific category in the UK first and stops once it has three', async () => {
    const { vi } = await import('vitest');
    const { findBetterAlternatives } = await import('../alternatives');
    const product = (code: string, name: string, sugar: number) => ({
      code, product_name: name, nova_group: 3, additives_n: 0,
      nutriments: { 'energy-kcal_100g': 380, proteins_100g: 10, sugars_100g: sugar, fat_100g: 8, 'saturated-fat_100g': 1, fiber_100g: 8, salt_100g: 0.1 },
    });
    const fetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ products: [product('11', 'A', 2), product('12', 'B', 4), product('13', 'C', 3), product('14', 'D', 40)] }),
    });
    vi.stubGlobal('fetch', fetch);
    const list = await findBetterAlternatives({ barcode: '99', unit: 'g', quality: { categories: ['en:cereals', 'en:breakfast-cereals'] } }, 20);
    expect(list.map((a) => a.food.name)).toEqual(['A', 'B', 'C']); // equal scores keep popularity order
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toMatch(/categories_tags=en%3Abreakfast-cereals&countries_tags=en%3Aunited-kingdom/);
    vi.unstubAllGlobals();
  });
});
