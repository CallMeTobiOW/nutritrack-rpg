import { describe, expect, it } from 'vitest';
import { analyseIngredients, normaliseIngredients } from '../ingredients';
import { parseQuality, QUALITY_VERSION } from '../openFoodFacts';
import { healthScore } from '../healthScore';

describe('analyseIngredients', () => {
  it('finds E-numbers in any common spelling and additive names', () => {
    const a = analyseIngredients('Ingredients: Sugar, Glucose Syrup, Gelatine, Acid (Citric Acid), Colours (E 129, E-133), Allura Red, Tartrazine, Emulsifier: Soya Lecithin, Flavourings.')!;
    expect(a.additives.sort()).toEqual(['e102', 'e129', 'e133', 'e322', 'e330'].sort());
    expect(a.nova).toBe(4);
    expect(a.markers).toEqual(expect.arrayContaining(['glucose syrup', 'flavouring', 'colour', 'emulsifier', 'additives']));
  });

  it('keeps sub-types it does not know and maps known families', () => {
    expect(analyseIngredients('raising agent: E450(i), E500(ii), stabiliser E322i')!.additives.sort()).toEqual(['e322i', 'e450', 'e500ii'].sort());
  });

  it('prefers the more specific caramel colour', () => {
    expect(analyseIngredients('Carbonated water, colour (sulphite ammonia caramel), phosphoric acid')!.additives.sort()).toEqual(['e150d', 'e338']);
  });

  it('estimates processing for simple foods', () => {
    expect(analyseIngredients('Rolled oats')).toMatchObject({ nova: 1, additives: [], markers: [] });
    expect(analyseIngredients('Chickpeas, water, salt')!.nova).toBe(3);
    expect(analyseIngredients('Haricot beans, tomatoes, water, sugar, spirit vinegar, modified cornflour, salt, spice extracts, herb extract')!.nova).toBe(3);
    expect(analyseIngredients('Wheat flour, water, yeast, salt, emulsifier (E471), flour treatment agent (ascorbic acid)')!.nova).toBe(4);
    expect(analyseIngredients('  ')).toBeNull();
  });

  it('tidies OCR text', () => {
    expect(normaliseIngredients('Sugar,\nColour E 129\r\nE-102')).toBe('sugar, colour e129 e102');
  });
});

describe('Open Food Facts products without an ingredients analysis', () => {
  it('analyses the ingredients text itself and marks NOVA as estimated', () => {
    const q = parseQuality({ ingredients_text_en: 'Water, sugar, flavourings, sweetener (sucralose), colour (E150d)' });
    expect(q).toMatchObject({ v: QUALITY_VERSION, ingredientsFrom: 'off', nova: 4, novaEstimated: true });
    expect(q.additives!.sort()).toEqual(['e150d', 'e955']);
    const r = healthScore({ per100: { energy: 2, sugar: 0.5, fat: 0, satFat: 0, sodium: 10 }, unit: 'ml', quality: q })!;
    expect(r.ingredientsChecked).toBe(true);
    expect(r.minuses.map((m) => m.text)).toEqual(expect.arrayContaining(['Ultra-processed (from its ingredients)', 'Sucralose (E955)']));
    expect(r.minuses.find((m) => m.text.startsWith('Ultra'))!.detail).toMatch(/Found: flavouring, sweetener, colour/);
  });

  it('trusts Open Food Facts’ own analysis when there is one', () => {
    const q = parseQuality({ ingredients_text: 'Water, flavourings', nova_group: 3, additives_n: 0, additives_tags: [] });
    expect(q.nova).toBe(3);
    expect(q.novaEstimated).toBeUndefined();
    expect(q.additives).toEqual([]);
  });
});
