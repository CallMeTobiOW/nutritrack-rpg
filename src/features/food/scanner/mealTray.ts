/**
 * The whole-meal scan tray: products scanned in a row, each with a portion,
 * logged together at the end. Kept in memory outside React so it survives a
 * detour (e.g. adding a missing product by hand) and coming back.
 */
import { useSyncExternalStore } from 'react';
import type { Food } from '../../../lib/models';
import { defaultPortion, nutrientsFor } from '../../../lib/food';

export interface TrayItem {
  key: string;
  food: Food;
  amount: number;
  servingLabel?: string;
  /** One portion and how many of it, so a second scan reads "2 × 1 can" rather than grams. */
  unit: { amount: number; servingLabel?: string };
  count: number;
}

function multiplied(unit: TrayItem['unit'], count: number): Pick<TrayItem, 'amount' | 'servingLabel'> {
  const amount = Math.round(unit.amount * count * 10) / 10;
  if (count === 1) return { amount, servingLabel: unit.servingLabel };
  // "2 × 2 × …" would be confusing: fall back to grams for an already-multiplied label.
  const servingLabel = unit.servingLabel && !/^\d+(\.\d+)?\s×\s/.test(unit.servingLabel) ? `${count} × ${unit.servingLabel}` : undefined;
  return { amount, servingLabel };
}

let items: TrayItem[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function emit(next: TrayItem[]) {
  items = next;
  listeners.forEach((l) => l());
}

export const mealTray = {
  get: () => items,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Add a product with its usual portion. Scanning the same product again adds another portion. */
  add(food: Food): TrayItem {
    const existing = items.find((i) => i.food.id === food.id);
    if (existing) {
      const count = existing.count + 1;
      const next = { ...existing, count, ...multiplied(existing.unit, count) };
      emit(items.map((i) => (i.key === existing.key ? next : i)));
      return next;
    }
    const unit = defaultPortion(food);
    const item: TrayItem = { key: `t${++seq}`, food, ...unit, unit, count: 1 };
    emit([...items, item]);
    return item;
  },
  /** Set the portion by hand; it becomes the unit for any further scans. */
  update(key: string, portion: { amount: number; servingLabel?: string }) {
    emit(items.map((i) => (i.key === key ? { ...i, ...portion, unit: portion, count: 1 } : i)));
  },
  remove(key: string) {
    emit(items.filter((i) => i.key !== key));
  },
  clear() {
    emit([]);
  },
};

export function useMealTray(): TrayItem[] {
  return useSyncExternalStore(mealTray.subscribe, mealTray.get, mealTray.get);
}

export function trayKcal(list: TrayItem[]): number {
  return list.reduce((s, i) => s + (nutrientsFor(i.food, i.amount).energy ?? 0), 0);
}
