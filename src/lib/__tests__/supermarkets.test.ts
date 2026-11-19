import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUPERMARKETS, supermarketsOf } from '../../data/supermarkets';
import { parseStores, searchShop, offProductToFood } from '../openFoodFacts';

const ids = (x: { brand?: string; stores?: string[] }) => supermarketsOf(x).map((s) => s.id);

describe('supermarkets', () => {
  it('lists the ten shops once each', () => {
    expect(SUPERMARKETS.map((s) => s.id)).toEqual(['tesco', 'sainsburys', 'asda', 'aldi', 'lidl', 'morrisons', 'coop', 'waitrose', 'marks', 'iceland']);
  });
  it.each([
    ['Tesco Finest', 'tesco'],
    ["Sainsbury's", 'sainsburys'],
    ['Sainsburys Taste the Difference', 'sainsburys'],
    ['Asda', 'asda'],
    ['ASDA Extra Special', 'asda'],
    ['Morrisons', 'morrisons'],
    ["Morrison's", 'morrisons'],
    ['Lidl', 'lidl'],
    ['Co-op', 'coop'],
    ['Co-operative Food', 'coop'],
    ['Coop', 'coop'],
    ['Waitrose & Partners', 'waitrose'],
    ['Marks & Spencer', 'marks'],
    ['Marks and Spencer', 'marks'],
    ['M&S', 'marks'],
    ['M&S Food', 'marks'],
    ['Iceland', 'iceland'],
    ['Aldi', 'aldi'],
  ])('recognises "%s"', (brand, id) => {
    expect(ids({ brand })).toEqual([id]);
  });
  it('does not mistake other brands for a shop', () => {
    expect(ids({ brand: 'Heinz' })).toEqual([]);
    expect(ids({ brand: 'Tescoma' })).toEqual([]);
    expect(ids({ brand: 'Mars' })).toEqual([]);
    expect(ids({ brand: 'Coopers' })).toEqual([]);
    expect(ids({})).toEqual([]);
  });
  it('combines own brand and stores', () => {
    expect(ids({ brand: 'Heinz', stores: ['Tesco', 'Asda, ', 'Corner shop'] })).toEqual(['tesco', 'asda']);
    expect(ids({ brand: 'Tesco', stores: ['Tesco', 'Aldi'] })).toEqual(['tesco', 'aldi']);
  });
});

describe('stores from Open Food Facts', () => {
  it('splits and tidies the list', () => {
    expect(parseStores('Tesco, Aldi,  Tesco ,')).toEqual(['Tesco', 'Aldi']);
    expect(parseStores('')).toBeUndefined();
    expect(parseStores(undefined)).toBeUndefined();
  });
  it('keeps stores on a product', () => {
    const f = offProductToFood({ code: '1', product_name: 'Beans', stores: 'Tesco, Asda', nutriments: { 'energy-kcal_100g': 78 } });
    expect(f?.stores).toEqual(['Tesco', 'Asda']);
  });
});

describe('searchShop', () => {
  afterEach(() => vi.unstubAllGlobals());
  const res = (products: unknown[]) => ({ ok: true, status: 200, json: async () => ({ products }) });
  const p = (code: string, name: string) => ({ code, product_name: name, nutriments: { 'energy-kcal_100g': 50 } });
  const tesco = SUPERMARKETS[0];

  it('asks for the shop own brand and its stock, UK only, and merges without repeats', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      urls.push(String(url));
      return String(url).includes('brands_tags=') ? res([p('1', 'Tesco Oranges'), p('2', 'Tesco Apples')]) : res([p('2', 'Tesco Apples'), p('3', 'Heinz Beans')]);
    }));
    const out = await searchShop(tesco, '');
    expect(out.map((o) => o.barcode)).toEqual(['1', '2', '3']);
    expect(urls.some((u) => u.includes('brands_tags=tesco') && u.includes('united-kingdom'))).toBe(true);
    expect(urls.some((u) => u.includes('stores_tags=tesco'))).toBe(true);
  });
  it('narrows by the search words', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      urls.push(String(url));
      return res([p('1', 'Tesco Oranges')]);
    }));
    await searchShop(tesco, 'orange');
    expect(urls.every((u) => u.includes('search_terms=orange') && u.includes('tag_1=tesco'))).toBe(true);
  });
  it('falls back to the shop name when the tags find nothing', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      urls.push(String(url));
      return String(url).includes('search_terms=orange%20Tesco') ? res([p('1', 'Tesco Oranges')]) : res([]);
    }));
    const out = await searchShop(tesco, 'orange');
    expect(out).toHaveLength(1);
  });
});
