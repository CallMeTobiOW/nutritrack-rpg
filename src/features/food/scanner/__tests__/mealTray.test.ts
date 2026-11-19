import { beforeEach, describe, expect, it } from 'vitest';
import { mealTray, trayKcal } from '../mealTray';
import type { Food } from '../../../../lib/models';

const bar: Food = { id: 'bar', name: 'Bar', source: 'off', unit: 'g', per100: { energy: 400 }, servings: [{ label: '1 bar (45 g)', amount: 45 }], favorite: false, useCount: 0, createdAt: 0, updatedAt: 0 };
const milk: Food = { id: 'milk', name: 'Milk', source: 'off', unit: 'ml', per100: { energy: 50 }, servings: [], favorite: false, useCount: 0, createdAt: 0, updatedAt: 0, lastAmount: 250 };

describe('meal tray', () => {
  beforeEach(() => mealTray.clear());

  it('adds each product with its usual portion and totals the calories', () => {
    mealTray.add(bar);
    mealTray.add(milk);
    const items = mealTray.get();
    expect(items.map((i) => [i.food.name, i.amount, i.servingLabel])).toEqual([
      ['Bar', 45, '1 bar (45 g)'],
      ['Milk', 250, undefined],
    ]);
    expect(trayKcal(items)).toBeCloseTo(180 + 125);
  });

  it('adds another portion when the same product is scanned again', () => {
    mealTray.add(bar);
    const again = mealTray.add(bar);
    expect(mealTray.get()).toHaveLength(1);
    expect([again.amount, again.servingLabel, again.count]).toEqual([90, '2 × 1 bar (45 g)', 2]);
    // A hand-picked portion becomes the new unit.
    mealTray.update(again.key, { amount: 30 });
    const third = mealTray.add(bar);
    expect([third.amount, third.servingLabel]).toEqual([60, undefined]);
  });

  it('edits and removes items', () => {
    const item = mealTray.add(bar);
    mealTray.update(item.key, { amount: 30, servingLabel: undefined });
    expect(mealTray.get()[0].amount).toBe(30);
    mealTray.remove(item.key);
    expect(mealTray.get()).toEqual([]);
  });
});
