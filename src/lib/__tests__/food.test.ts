import { describe, expect, it } from 'vitest';
import { amountLabel, defaultPortionKcal, mealForTime, portionOptions, servingText } from '../food';

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

  it('labels servings and amounts', () => {
    const [, bar] = portionOptions({ unit: 'g', servings: [{ label: '1 bar', amount: 45 }] });
    expect(servingText(bar, 1, 'g')).toBe('1 bar (45 g)');
    expect(servingText(bar, 2, 'g')).toBe('2 × 1 bar (45 g)');
    const [, scoop] = portionOptions({ unit: 'g', servings: [{ label: '30 g', amount: 30 }] });
    expect(servingText(scoop, 1.5, 'g')).toBe('1.5 × 30 g');
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
