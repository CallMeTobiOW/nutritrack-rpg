import { describe, expect, it } from 'vitest';
import { amountLabel, defaultPortionKcal, mealForTime, per100Problem, portionOptions, servingText } from '../food';

describe('food helpers', () => {
  it('guesses the meal from the time of day', () => {
    expect(mealForTime(new Date(2026, 0, 1, 7, 30))).toBe('breakfast');
    expect(mealForTime(new Date(2026, 0, 1, 12, 0))).toBe('lunch');
    expect(mealForTime(new Date(2026, 0, 1, 16, 0))).toBe('snacks');
    expect(mealForTime(new Date(2026, 0, 1, 19, 0))).toBe('dinner');
    expect(mealForTime(new Date(2026, 0, 1, 23, 30))).toBe('snacks');
  });

  it('builds portion options from servings', () => {
    const opts = portionOptions({ unit: 'g', servings: [{ label: '1 bar', amount: 45 }] });
    expect(opts.map((o) => [o.label, o.amount])).toEqual([
      ['g', 1],
      ['1 bar', 45],
    ]);
  });

  it('rejects impossible custom food values', () => {
    expect(per100Problem({ energy: 150, protein: 12.5, carbs: 10, sugar: 4, fat: 6.4, satFat: 2 }, 'g')).toBeNull();
    expect(per100Problem({ energy: 99999 }, 'g')).toMatch(/too high/);
    expect(per100Problem({ energy: 300, carbs: 10, sugar: 25 }, 'g')).toMatch(/Sugars/);
    expect(per100Problem({ energy: 300, fat: 5, satFat: 9 }, 'g')).toMatch(/Saturates/);
    expect(per100Problem({ energy: 300, protein: 60, carbs: 60 }, 'g')).toMatch(/add up/);
    // A syrup can carry a little over 100 g of sugar per 100 ml.
    expect(per100Problem({ energy: 420, carbs: 110, sugar: 108 }, 'ml')).toBeNull();
  });

  it('labels servings and amounts', () => {
    const [, bar] = portionOptions({ unit: 'g', servings: [{ label: '1 bar', amount: 45 }] });
    expect(servingText(bar, 1, 'g')).toBe('1 bar (45 g)');
    expect(servingText(bar, 2, 'g')).toBe('2 × 1 bar (45 g)');
    const [, scoop] = portionOptions({ unit: 'g', servings: [{ label: '30 g', amount: 30 }] });
    expect(servingText(scoop, 1.5, 'g')).toBe('1.5 × 30 g');
    // "15 g" in the label must not count as stating a 5 g serving.
    const [, slice] = portionOptions({ unit: 'g', servings: [{ label: '1 slice (15 g)', amount: 5 }] });
    expect(servingText(slice, 1, 'g')).toBe('1 slice (15 g) (5 g)');
    expect(amountLabel(90, 'g', '2 × 1 bar (45 g)')).toBe('2 × 1 bar (45 g) · 90 g');
    expect(amountLabel(150, 'ml')).toBe('150 ml');
    expect(amountLabel(45, 'g', '45 g')).toBe('45 g');
    expect(amountLabel(45, 'g', '1 bar (45g)')).toBe('1 bar (45g)');
  });

  it('computes default portion calories without inventing data', () => {
    expect(defaultPortionKcal({ unit: 'g', per100: { energy: 200 }, servings: [{ label: '1 pot', amount: 150 }] })).toEqual({ kcal: 300, label: '1 pot' });
    expect(defaultPortionKcal({ unit: 'g', per100: {}, servings: [] })).toEqual({ kcal: undefined, label: '100 g' });
  });
});
