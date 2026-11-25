import { describe, expect, it } from 'vitest';
import { firstAlignedIndex, offsetForValue, snapToScale, stepCount, stepDecimals, valueForOffset, type RulerScale } from '../ruler';

const kg: RulerScale = { min: 25, max: 350, step: 0.1, px: 6 };
const age: RulerScale = { min: 13, max: 100, step: 1, px: 14 };

describe('ruler scale', () => {
  it('counts decimals in a step', () => {
    expect(stepDecimals(1)).toBe(0);
    expect(stepDecimals(0.1)).toBe(1);
    expect(stepDecimals(0.25)).toBe(2);
  });

  it('counts whole steps without float drift', () => {
    expect(stepCount(kg)).toBe(3250);
    expect(stepCount(age)).toBe(87);
    expect(stepCount({ min: 55.2, max: 771.6, step: 0.1 })).toBe(7164);
  });

  it('snaps to the grid and clamps to range', () => {
    expect(snapToScale(82.34, kg)).toBe(82.3);
    expect(snapToScale(82.36, kg)).toBe(82.4);
    expect(snapToScale(10, kg)).toBe(25);
    expect(snapToScale(999, kg)).toBe(350);
    expect(snapToScale(29.6, age)).toBe(30);
  });

  it('round-trips value ↔ offset exactly', () => {
    for (const v of [25, 25.1, 70, 82.3, 199.9, 350]) {
      expect(valueForOffset(offsetForValue(v, kg), kg)).toBe(v);
    }
    for (let v = 13; v <= 100; v++) expect(valueForOffset(offsetForValue(v, age), age)).toBe(v);
  });

  it('maps a mid-tick scroll offset to the nearest step', () => {
    expect(valueForOffset(14 * 17 + 6, age)).toBe(30); // 6 px past 30 snaps back
    expect(valueForOffset(14 * 17 + 8, age)).toBe(31); // 8 px past 30 rounds up
    expect(valueForOffset(-50, age)).toBe(13);
  });

  it('aligns labels on round numbers', () => {
    // Age starts at 13; first multiple of 5 is 15, two steps in.
    expect(firstAlignedIndex(age, 5)).toBe(2);
    // kg starts at 25.0 (250 tenths); every 10 tenths = whole kilos, already aligned.
    expect(firstAlignedIndex(kg, 10)).toBe(0);
    // Inches from 40: first whole foot is 48 in.
    expect(firstAlignedIndex({ min: 40, step: 1 }, 12)).toBe(8);
  });
});
