import { describe, expect, it } from 'vitest';
import { cmToFeetInches, formatHeight, formatWeight, kgToUnit, unitToKg } from '../units';

describe('height units', () => {
  it('splits centimetres into feet and inches', () => {
    expect(cmToFeetInches(177.8)).toEqual({ ft: 5, inch: 10 });
    expect(cmToFeetInches(152.4)).toEqual({ ft: 5, inch: 0 });
    // 182.6 cm is 71.9″: rounds to 6′ 0″, never 5′ 12″.
    expect(cmToFeetInches(182.6)).toEqual({ ft: 6, inch: 0 });
  });

  it('formats heights', () => {
    expect(formatHeight(177.6, 'cm')).toBe('178 cm');
    expect(formatHeight(177.8, 'ft')).toBe('5′ 10″');
  });
});

describe('weight units', () => {
  it('round-trips pounds', () => {
    expect(unitToKg(kgToUnit(80, 'lbs'), 'lbs')).toBeCloseTo(80, 10);
    expect(formatWeight(80, 'lbs')).toBe('176.4 lbs');
  });
});
