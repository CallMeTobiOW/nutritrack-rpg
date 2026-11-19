import { describe, expect, it } from 'vitest';
import { GENERIC_FOODS } from '../../data/genericFoods';
import { per100Problem } from '../food';

describe('bundled everyday foods', () => {
  it('has unique names', () => {
    const names = GENERIC_FOODS.map((f) => f.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(GENERIC_FOODS.map((f) => [f.name, f] as const))('%s: passes the custom-food sanity checks', (_n, f) => {
    expect(per100Problem(f.per100, f.unit)).toBeNull();
  });

  // Calories should match what protein, carbs, fat and fibre give (4, 4, 9 and 2 kcal per gram),
  // within 12% or 8 kcal: labels round, and fibre/polyols differ a little.
  it.each(GENERIC_FOODS.map((f) => [f.name, f] as const))('%s: calories agree with the macros', (_n, f) => {
    const v = f.per100;
    const fromMacros = 4 * (v.protein ?? 0) + 4 * (v.carbs ?? 0) + 9 * (v.fat ?? 0) + 2 * (v.fiber ?? 0);
    expect(Math.abs(fromMacros - (v.energy ?? 0))).toBeLessThanOrEqual(Math.max(8, 0.12 * (v.energy ?? 0)));
  });

  it('gives every food a sensible serving', () => {
    for (const f of GENERIC_FOODS) {
      expect(f.servings).toHaveLength(1);
      expect(f.servings[0].amount).toBeGreaterThan(0);
      expect(f.servings[0].amount).toBeLessThanOrEqual(500);
      // "1 medium orange (peeled, 130 g)" must state its own weight.
      expect(f.servings[0].label).toContain(String(f.servings[0].amount));
    }
  });

  it('covers the staples people search for', () => {
    const has = (n: string) => GENERIC_FOODS.some((f) => f.name.toLowerCase().includes(n));
    for (const n of ['orange', 'apple', 'banana', 'chicken breast', 'egg', 'milk', 'rice', 'bread', 'potato', 'cheddar']) expect(has(n)).toBe(true);
  });
});
