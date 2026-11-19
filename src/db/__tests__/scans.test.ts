import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { addDiaryEntries, addDiaryEntry, ensureInitialized, saveCustomFood, saveOffFood } from '../actions';
import { STALE_AFTER_MS, addPendingScan, findSavedFood, needsRefresh, resolveBarcode, retryPendingScans, sameProduct } from '../scans';
import { RETRY_DELAYS_MS } from '../../lib/openFoodFacts';
import { defaultPortion, portionOptions, presetPortion } from '../../lib/food';
import type { Food } from '../../lib/models';

RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length);

const BEANS = '5000157024671';
const offBeans = {
  status: 1,
  product: {
    code: BEANS,
    product_name: 'Baked beans in tomato sauce',
    brands: 'Test Foods',
    quantity: '415 g',
    product_quantity: 415,
    product_quantity_unit: 'g',
    serving_size: '1/2 can (207 g)',
    serving_quantity: 207,
    nutriscore_grade: 'a',
    nova_group: 3,
    nutriments: { 'energy-kcal_100g': 78, proteins_100g: 4.7, carbohydrates_100g: 12.5, sugars_100g: 4.7, fat_100g: 0.2, fiber_100g: 3.7, salt_100g: 0.6 },
  },
};

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
  await ensureInitialized();
});
afterEach(() => vi.unstubAllGlobals());

describe('resolveBarcode', () => {
  it('finds a product online, saves it for offline use and records the scan', async () => {
    const fetch = vi.fn().mockResolvedValue(json(offBeans));
    vi.stubGlobal('fetch', fetch);
    const r = await resolveBarcode(BEANS);
    expect(r.kind).toBe('found');
    if (r.kind !== 'found') return;
    expect(r.from).toBe('online');
    expect(r.food.quality).toEqual({ nutriScore: 'a', nova: 3 });
    expect(r.food.lastScannedAt).toBeTypeOf('number');
    expect(r.food.servings.map((s) => s.label)).toEqual(['1/2 can (207 g)', 'Whole pack (415 g)']);

    // Second scan: answered from the device, no network.
    const again = await resolveBarcode(BEANS);
    expect(again.kind === 'found' && again.from).toBe('device');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await db.foods.count()).toBe(1);
  });

  it('matches a UPC-A scan to the EAN-13 form saved on the device', async () => {
    await saveOffFood({ name: 'Soup', barcode: '0036000291452', source: 'off', unit: 'g', per100: { energy: 50 }, servings: [], favorite: false, useCount: 0, createdAt: 0, updatedAt: 0 });
    const r = await resolveBarcode('036000291452');
    expect(r.kind === 'found' && r.food.name).toBe('Soup');
    expect(sameProduct('036000291452', '0036000291452')).toBe(true);
  });

  it('puts an unknown product in the inbox as "not found"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ status: 0 })));
    const r = await resolveBarcode('5000159484695');
    expect(r.kind).toBe('notfound');
    expect((await db.settings.get('settings'))?.pendingScans).toMatchObject([{ code: '5000159484695', status: 'notfound' }]);
  });

  it('queues a scan made without signal and finds it once back online', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const r = await resolveBarcode(BEANS);
    expect(r.kind).toBe('queued');
    expect((await db.settings.get('settings'))?.pendingScans).toMatchObject([{ code: BEANS, status: 'offline' }]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(offBeans)));
    expect(await retryPendingScans()).toBe(1);
    expect((await db.settings.get('settings'))?.pendingScans).toEqual([]);
    expect((await findSavedFood(BEANS))?.lastScannedAt).toBeTypeOf('number');
  });

  it('keeps the inbox short and without duplicates', async () => {
    for (let i = 0; i < 40; i++) await addPendingScan(String(10000000 + i), 'offline');
    await addPendingScan('10000039', 'notfound');
    const list = (await db.settings.get('settings'))!.pendingScans!;
    expect(list).toHaveLength(30);
    expect(list[0]).toMatchObject({ code: '10000039', status: 'notfound' });
    expect(list.filter((p) => p.code === '10000039')).toHaveLength(1);
  });

  it('clears the inbox entry once the product is added by hand', async () => {
    await addPendingScan('5000159484695', 'notfound');
    await saveCustomFood({ name: 'Mystery bar', unit: 'g', per100: { energy: 400 }, servings: [], barcode: '5000159484695' });
    expect((await db.settings.get('settings'))?.pendingScans).toEqual([]);
  });
});

describe('refreshing downloaded products', () => {
  const base: Omit<Food, 'id'> = { name: 'Beans', barcode: BEANS, source: 'off', unit: 'g', per100: { energy: 78 }, servings: [], favorite: false, useCount: 0, createdAt: 0, updatedAt: 0 };

  it('only refreshes old, unedited downloads', () => {
    const now = 10 * STALE_AFTER_MS;
    expect(needsRefresh({ ...base, id: 'a', fetchedAt: now - STALE_AFTER_MS - 1 }, now)).toBe(true);
    expect(needsRefresh({ ...base, id: 'a', fetchedAt: now - 1000 }, now)).toBe(false);
    expect(needsRefresh({ ...base, id: 'a', fetchedAt: 0, edited: true }, now)).toBe(false);
    expect(needsRefresh({ ...base, id: 'a', source: 'custom', fetchedAt: 0 }, now)).toBe(false);
  });

  it('never overwrites values the player corrected', async () => {
    const saved = await saveOffFood(base);
    const fixed = await saveCustomFood({ name: 'Beans (fixed)', unit: 'g', per100: { energy: 80, protein: 5 }, servings: [], barcode: BEANS }, saved.id);
    expect(fixed.edited).toBe(true);
    expect(fixed.source).toBe('off');
    const refreshed = await saveOffFood({ ...base, per100: { energy: 1 }, quality: { nutriScore: 'a' } });
    expect(refreshed.per100).toEqual({ energy: 80, protein: 5 });
    expect(refreshed.name).toBe('Beans (fixed)');
    expect(refreshed.quality).toEqual({ nutriScore: 'a' });
  });
});

describe('quick re-log', () => {
  it('remembers the last portion of a food and offers it first', async () => {
    const food = await saveOffFood({ name: 'Beans', barcode: BEANS, source: 'off', unit: 'g', per100: { energy: 78 }, servings: [{ label: '1/2 can (207 g)', amount: 207 }], favorite: false, useCount: 0, createdAt: 0, updatedAt: 0 });
    expect(defaultPortion(food)).toEqual({ amount: 207, servingLabel: '1/2 can (207 g)' });
    await addDiaryEntry({ date: '2026-11-19', meal: 'lunch', food, amount: 414, servingLabel: '2 × 1/2 can (207 g)' });
    const after = (await db.foods.get(food.id))!;
    expect(after.lastAmount).toBe(414);
    expect(presetPortion(portionOptions(after), after.lastAmount, after.lastServingLabel)).toEqual({ key: 's0', qty: 2 });
    expect(defaultPortion(after)).toEqual({ amount: 414, servingLabel: '2 × 1/2 can (207 g)' });
  });

  it('falls back to grams when the last portion was weighed', () => {
    expect(presetPortion(portionOptions({ unit: 'g', servings: [{ label: '1 bar', amount: 45 }] }), 60)).toEqual({ key: 'raw', qty: 60 });
    expect(presetPortion(portionOptions({ unit: 'g', servings: [] }))).toEqual({ key: 'raw', qty: 100 });
  });

  it('logs a whole scanned meal in one go', async () => {
    const a = await saveOffFood({ name: 'Beans', barcode: BEANS, source: 'off', unit: 'g', per100: { energy: 78 }, servings: [], favorite: false, useCount: 0, createdAt: 0, updatedAt: 0 });
    const b = await saveCustomFood({ name: 'Toast', unit: 'g', per100: { energy: 250 }, servings: [] });
    const entries = await addDiaryEntries([
      { date: '2026-11-19', meal: 'dinner', food: a, amount: 200 },
      { date: '2026-11-19', meal: 'dinner', food: b, amount: 80 },
    ]);
    expect(entries).toHaveLength(2);
    expect(await db.diary.where('[date+meal]').equals(['2026-11-19', 'dinner']).count()).toBe(2);
    expect((await db.foods.get(b.id))?.useCount).toBe(1);
    expect(await addDiaryEntries([])).toEqual([]);
  });
});
