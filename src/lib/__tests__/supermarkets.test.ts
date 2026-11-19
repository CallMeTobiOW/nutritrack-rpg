import { describe, expect, it } from 'vitest';
import { SUPERMARKETS, shopLine, supermarketsOf } from '../../data/supermarkets';
import { parseStores, offProductToFood } from '../openFoodFacts';

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

describe('shopLine', () => {
  it('says own brand, sold at, or both', () => {
    expect(shopLine({ brand: 'Tesco Finest' })).toBe('Tesco own brand');
    expect(shopLine({ brand: 'Heinz', stores: ['Tesco', 'Asda'] })).toBe('Sold at Tesco, Asda');
    expect(shopLine({ brand: 'Tesco', stores: ['Tesco', 'Aldi'] })).toBe('Tesco own brand · also sold at Aldi');
    expect(shopLine({ brand: 'Heinz' })).toBeNull();
  });
});
