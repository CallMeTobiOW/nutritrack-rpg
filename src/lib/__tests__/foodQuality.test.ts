import { describe, expect, it } from 'vitest';
import { energyMismatch, kcalFromMacros, qualityIssues } from '../foodQuality';

describe('energy vs macros', () => {
  it('computes kcal from macros', () => {
    expect(kcalFromMacros({ protein: 10, carbs: 50, fat: 10, fiber: 5 })).toBe(40 + 200 + 90 + 10);
    expect(kcalFromMacros({ protein: 10, carbs: 50 })).toBeUndefined();
  });

  it('accepts real labels (rounding, fibre)', () => {
    // Oats: 375 kcal, 11 P, 60 C, 8 F, 9 fibre → 374.
    expect(energyMismatch({ energy: 375, protein: 11, carbs: 60, fat: 8, fiber: 9 })).toBeNull();
    // Cola: 42 kcal, 10.6 g sugar.
    expect(energyMismatch({ energy: 42, protein: 0, carbs: 10.6, fat: 0 })).toBeNull();
  });

  it('flags a kJ value typed into the kcal box', () => {
    expect(energyMismatch({ energy: 1569, protein: 11, carbs: 60, fat: 8 })).toEqual({ stated: 1569, fromMacros: 356 });
  });
});

describe('qualityIssues', () => {
  it('flags missing calories and missing macros', () => {
    expect(qualityIssues({ per100: {}, unit: 'g' })[0].level).toBe('missing');
    const t = qualityIssues({ per100: { energy: 100, protein: 2 }, unit: 'g' }).map((i) => i.text).join(' ');
    expect(t).toMatch(/No carbs, fat listed/);
  });

  it('is quiet for a good product', () => {
    expect(qualityIssues({ per100: { energy: 375, protein: 11, carbs: 60, fat: 8, fiber: 9 }, unit: 'g', quality: { nutriScore: 'a' } })).toEqual([]);
  });

  it('skips the calorie check for alcoholic drinks', () => {
    const wine = { per100: { energy: 83, protein: 0.1, carbs: 2.6, fat: 0 }, unit: 'ml' as const };
    expect(qualityIssues(wine)).toHaveLength(1);
    expect(qualityIssues({ ...wine, quality: { alcohol: 12 } })).toEqual([]);
  });

  it('mentions an incomplete Open Food Facts entry only when nothing more specific is wrong', () => {
    expect(qualityIssues({ per100: { energy: 375, protein: 11, carbs: 60, fat: 8 }, unit: 'g', quality: { incomplete: true } })[0].text).toMatch(/incomplete/);
  });
});
