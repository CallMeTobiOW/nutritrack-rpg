import { describe, expect, it } from 'vitest';
import { completeness, progress, scaleNutrients, sumNutrients } from '../nutrition';

describe('scaleNutrients', () => {
  it('scales per-100 values to the eaten amount', () => {
    const v = scaleNutrients({ energy: 250, protein: 10, fat: 5.5 }, 40);
    expect(v.energy).toBeCloseTo(100);
    expect(v.protein).toBeCloseTo(4);
    expect(v.fat).toBeCloseTo(2.2);
  });

  it('keeps unknown nutrients unknown instead of zero', () => {
    const v = scaleNutrients({ energy: 100 }, 50);
    expect(v.energy).toBe(50);
    expect('vitC' in v).toBe(false);
    expect(v.protein).toBeUndefined();
  });

  it('keeps genuine zeros as zero', () => {
    expect(scaleNutrients({ sugar: 0 }, 200).sugar).toBe(0);
  });

  it('returns nothing for invalid amounts', () => {
    expect(scaleNutrients({ energy: 100 }, -5)).toEqual({});
    expect(scaleNutrients({ energy: 100 }, Number.NaN)).toEqual({});
  });
});

describe('sumNutrients', () => {
  it('sums known values and counts missing ones', () => {
    const t = sumNutrients([{ energy: 100, vitC: 10 }, { energy: 50 }, { energy: 25, vitC: 5 }]);
    expect(t.energy).toEqual({ value: 175, known: 3, unknown: 0 });
    expect(t.vitC).toEqual({ value: 15, known: 2, unknown: 1 });
    expect(completeness(t.energy)).toBe('complete');
    expect(completeness(t.vitC)).toBe('partial');
    expect(completeness(t.iron)).toBe('unknown');
  });

  it('reports "none" when nothing was logged', () => {
    expect(completeness(sumNutrients([]).energy)).toBe('none');
  });
});

describe('progress', () => {
  it('computes remaining and percent', () => {
    expect(progress(1500, 2000)).toMatchObject({ remaining: 500, percent: 75 });
    expect(progress(2500, 2000)).toMatchObject({ remaining: -500, percent: 125 });
    expect(progress(10, 0)).toMatchObject({ ratio: 0, percent: 0 });
  });
});
