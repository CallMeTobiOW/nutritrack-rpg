import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RETRY_DELAYS_MS,
  amountFromText,
  barcodeCandidates,
  isPlausibleBarcode,
  isValidGtin,
  lookupBarcode,
  normaliseBarcode,
  offProductToFood,
  parseNutriments,
  QUALITY_VERSION,
  parseQuality,
  parseServings,
  searchProducts,
  upcEToUpcA,
} from '../openFoodFacts';

describe('typed barcodes', () => {
  it('accepts real codes and rejects a wrong check digit', () => {
    expect(isPlausibleBarcode('5449000000996')).toBe(true); // EAN-13
    expect(isPlausibleBarcode('3017620422003')).toBe(true);
    expect(isPlausibleBarcode('1234567890123')).toBe(false);
    expect(isPlausibleBarcode('5449000000997')).toBe(false);
  });
});

describe('busy service', () => {
  afterEach(() => vi.unstubAllGlobals());
  RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 0, 0);
  const ok = { ok: true, status: 200, json: async () => ({ products: [{ code: '1', product_name: 'Banana', nutriments: { 'energy-kcal_100g': 89 } }] }) };
  const busy = { ok: false, status: 503, json: async () => ({}) };

  it('retries a 503 and then succeeds', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(busy).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok);
    vi.stubGlobal('fetch', fetch);
    const results = await searchProducts('banana');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(results[0]?.name).toBe('Banana');
  });

  it('gives an honest message when the service keeps failing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(busy));
    await expect(searchProducts('banana')).rejects.toThrow(/may be busy/);
  });
});

// Shape mirrors a real Open Food Facts v2 product response (values in g per 100 g).
const spread = {
  code: '3017624010701',
  product_name: 'Hazelnut cocoa spread',
  brands: 'Test Brand, Other',
  image_front_small_url: 'https://images.openfoodfacts.org/images/products/301/762/401/0701/front_en.200.jpg',
  quantity: '400 g',
  product_quantity_unit: 'g',
  serving_size: '15 g',
  serving_quantity: 15,
  nutriments: {
    'energy-kcal_100g': 539,
    'energy-kj_100g': 2252,
    energy_100g: 2252,
    fat_100g: 30.9,
    'saturated-fat_100g': 10.6,
    carbohydrates_100g: 57.5,
    sugars_100g: 56.3,
    proteins_100g: 6.3,
    salt_100g: 0.107,
    sodium_100g: 0.0428,
    'vitamin-c_100g': 0.0024, // 2.4 mg
    'vitamin-d_100g': 0.0000025, // 2.5 µg
    calcium_100g: '0.12', // strings occur in the wild
  },
};

describe('parseNutriments', () => {
  it('reads macros and converts units', () => {
    const n = parseNutriments(spread.nutriments);
    expect(n.energy).toBe(539);
    expect(n.protein).toBe(6.3);
    expect(n.carbs).toBe(57.5);
    expect(n.fat).toBe(30.9);
    expect(n.satFat).toBe(10.6);
    expect(n.sugar).toBe(56.3);
    expect(n.sodium).toBeCloseTo(42.8);
    expect(n.vitC).toBeCloseTo(2.4);
    expect(n.vitD).toBeCloseTo(2.5);
    expect(n.calcium).toBeCloseTo(120);
  });

  it('never invents missing nutrients', () => {
    const n = parseNutriments(spread.nutriments);
    expect(n.fiber).toBeUndefined();
    expect(n.iron).toBeUndefined();
    expect(n.vitB12).toBeUndefined();
  });

  it('converts kJ when kcal is missing', () => {
    expect(parseNutriments({ energy_100g: 418.4 }).energy).toBeCloseTo(100);
    expect(parseNutriments({ 'energy-kj_100g': 836.8 }).energy).toBeCloseTo(200);
  });

  it('derives sodium from salt only when sodium is missing', () => {
    expect(parseNutriments({ salt_100g: 1 }).sodium).toBeCloseTo(400);
    expect(parseNutriments({ salt_100g: 1, sodium_100g: 0.3 }).sodium).toBeCloseTo(300);
  });

  it('rejects impossible or empty values', () => {
    const n = parseNutriments({ proteins_100g: 250, fat_100g: -1, sugars_100g: '', 'energy-kcal_100g': 5000 });
    expect(n.protein).toBeUndefined();
    expect(n.fat).toBeUndefined();
    expect(n.sugar).toBeUndefined();
    expect(n.energy).toBeUndefined();
  });

  it('keeps reported zeros', () => {
    expect(parseNutriments({ sugars_100g: 0 }).sugar).toBe(0);
  });
});

describe('offProductToFood', () => {
  it('maps a product', () => {
    const f = offProductToFood(spread, 1)!;
    expect(f.name).toBe('Hazelnut cocoa spread');
    expect(f.brand).toBe('Test Brand');
    expect(f.barcode).toBe('3017624010701');
    expect(f.unit).toBe('g');
    expect(f.servings).toEqual([
      { label: '15 g', amount: 15 },
      { label: 'Whole pack (400 g)', amount: 400 },
    ]);
    expect(f.source).toBe('off');
  });

  it('detects drinks measured in ml', () => {
    expect(offProductToFood({ code: '1', product_name: 'Juice', quantity: '1 L' })!.unit).toBe('ml');
    expect(offProductToFood({ code: '1', product_name: 'Cola', nutrition_data_per: '100ml' })!.unit).toBe('ml');
  });

  it('falls back to a placeholder name', () => {
    expect(offProductToFood({ code: '123' })!.name).toBe('Product 123');
    expect(offProductToFood({})).toBeNull();
  });

  it('ignores nonsense serving sizes', () => {
    expect(offProductToFood({ code: '1', product_name: 'x', serving_quantity: 0 })!.servings).toEqual([]);
    expect(offProductToFood({ code: '1', product_name: 'x', serving_quantity: '30', serving_size: '30 g (2 biscuits)' })!.servings).toEqual([
      { label: '30 g (2 biscuits)', amount: 30 },
    ]);
  });
});

describe('barcodes', () => {
  it('validates GS1 check digits', () => {
    expect(isValidGtin('3017624010701')).toBe(true); // EAN-13
    expect(isValidGtin('3017624010702')).toBe(false);
    expect(isValidGtin('96385074')).toBe(true); // EAN-8
    expect(isValidGtin('036000291452')).toBe(true); // UPC-A
  });

  it('expands UPC-E to UPC-A', () => {
    expect(upcEToUpcA('04252614')).toBe('042100005264');
    expect(isValidGtin(upcEToUpcA('04252614')!)).toBe(true);
    expect(upcEToUpcA('01234565')).toBe('012345000065');
    expect(upcEToUpcA('12345678')).toBe('123456000078');
    expect(upcEToUpcA('23456789')).toBeNull(); // number system must be 0 or 1
  });

  it('builds lookup candidates', () => {
    expect(barcodeCandidates('036000291452')).toEqual(['036000291452', '0036000291452']);
    expect(barcodeCandidates('0036000291452')).toContain('036000291452');
    expect(barcodeCandidates('04252614')).toEqual(['04252614', '042100005264', '0042100005264']);
  });

  it('normalises typed codes', () => {
    expect(normaliseBarcode(' 5 000159 484695 ')).toBe('5000159484695');
    expect(normaliseBarcode('50-00159')).toBe('5000159');
    expect(normaliseBarcode('abc')).toBeNull();
    expect(normaliseBarcode('123')).toBeNull();
  });
});

describe('portions and quality from Open Food Facts', () => {
  it('reads a serving from the label text when the number is missing', () => {
    expect(amountFromText('1 bar (45 g)')).toBe(45);
    expect(amountFromText('33 cl')).toBe(330);
    expect(amountFromText('0,5 l')).toBe(500);
    expect(amountFromText('2 biscuits')).toBeUndefined();
    expect(parseServings({ serving_size: '1 bar (45 g)' }, 'g')).toEqual([{ label: '1 bar (45 g)', amount: 45 }]);
  });

  it('offers the whole pack for single-serve products, not multipacks or big bags', () => {
    expect(parseServings({ quantity: '330 ml', product_quantity: 330, product_quantity_unit: 'ml' }, 'ml')).toEqual([
      { label: 'Whole pack (330 ml)', amount: 330 },
    ]);
    expect(parseServings({ quantity: '6 x 25 g', product_quantity: 150, serving_quantity: 25, serving_size: '25 g' }, 'g')).toEqual([
      { label: '25 g', amount: 25 },
    ]);
    expect(parseServings({ quantity: '1 kg', product_quantity: 1000 }, 'g')).toEqual([]);
    // Same size as the serving: listed once.
    expect(parseServings({ quantity: '45 g', product_quantity: 45, serving_quantity: 45, serving_size: '1 bar' }, 'g')).toHaveLength(1);
  });

  it('reads Nutri-Score, NOVA, completeness and alcohol', () => {
    expect(parseQuality({ nutriscore_grade: 'B', nova_group: '4', states_tags: ['en:nutrition-facts-to-be-completed'], nutriments: { alcohol_100g: 5 } })).toEqual({
      v: QUALITY_VERSION,
      nutriScore: 'b',
      nova: 4,
      incomplete: true,
      alcohol: 5,
    });
    expect(parseQuality({ nutriscore_grade: 'unknown', nova_group: 9 })).toEqual({ v: QUALITY_VERSION });
  });

  it('reads additives (only once ingredients are analysed), fruit/veg share and categories', () => {
    const q = parseQuality({
      additives_n: 3,
      additives_tags: ['en:e129', 'en:e330', 'en:e129', 'en:not-an-additive'],
      categories_tags: ['en:snacks', 'en:sweet-snacks', 'en:confectioneries', 'en:candies', 'en:gummies', 'fr:bonbons'],
      nutriments: { 'fruits-vegetables-legumes-estimate-from-ingredients_100g': 12 },
    });
    expect(q.additives).toEqual(['e129', 'e330']);
    expect(q.categories).toEqual(['en:sweet-snacks', 'en:confectioneries', 'en:candies', 'en:gummies']);
    expect(q.fruitVeg).toBe(12);
    expect(parseQuality({}).additives).toBeUndefined();
    expect(parseQuality({ additives_n: 0, additives_tags: [] }).additives).toEqual([]);
  });

  it('prefers the English product name', () => {
    expect(offProductToFood({ code: '1', product_name: 'Pâte à tartiner', product_name_en: 'Hazelnut spread' })!.name).toBe('Hazelnut spread');
  });

  it('asks for English and identifies the app when looking up a barcode', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 1, product: { code: '5000159484695', product_name: 'Bar' } }) });
    vi.stubGlobal('fetch', fetch);
    const f = await lookupBarcode('5000159484695');
    expect(f?.name).toBe('Bar');
    expect(f?.fetchedAt).toBeTypeOf('number');
    expect(fetch.mock.calls[0][0]).toMatch(/lc=en&app_name=NutriTrackRPG/);
    vi.unstubAllGlobals();
  });
});
