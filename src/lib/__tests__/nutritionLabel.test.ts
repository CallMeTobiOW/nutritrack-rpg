import { describe, expect, it } from 'vitest';
import { parseNutritionLabel } from '../scan/nutritionLabel';

describe('reading a nutrition table', () => {
  it('reads a two-column UK table and takes the per-100 g column', () => {
    const r = parseNutritionLabel(`Nutrition
Typical values per 100g per 1/2 pack (200g)
Energy 420kJ/100kcal 840kJ/200kcal
Fat 3.0g 6.0g
of which saturates 1.2g 2.4g
Carbohydrate 12g 24g
of which sugars 2.0g 4.0g
Fibre 1.5g 3.0g
Protein 5.5g 11g
Salt 0.60g 1.2g
Reference intake of an average adult (8400kJ/2000kcal)`)!;
    expect(r.basis).toBe('100');
    expect(r.values).toEqual({ energy: 100, fat: 3, satFat: 1.2, carbs: 12, sugar: 2, fiber: 1.5, protein: 5.5, salt: 0.6 });
    expect(r.servingAmount).toBe(200);
    expect(r.servingLabel).toBe('1/2 pack (200 g)');
    expect(r.unit).toBe('g');
    expect(r.warnings).toEqual([]);
  });

  it('works out which column is per 100 g when the serving column is first', () => {
    const r = parseNutritionLabel(`Per serving (30g) Per 100g
Energy 464kJ/110kcal 1546kJ/370kcal
Fat 1.5g 5.0g
of which saturates 0.3g 1.0g
Carbohydrate 20g 67g
of which sugars 0.9g 3.0g
Protein 3.0g 10g
Salt 0.30g 1.0g`)!;
    expect(r.values.energy).toBe(370);
    expect(r.values.carbs).toBe(67);
    expect(r.values.salt).toBe(1);
    expect(r.servingAmount).toBe(30);
  });

  it('reads a single per-100 g column with a %RI column ignored', () => {
    const r = parseNutritionLabel(`Typical values per 100g
Energy 1046kJ / 250kcal 13%
Fat 9.0g 13%
of which saturates 4.0g 20%
Carbohydrate 30g 12%
of which sugars 8.0g 9%
Fibre 2.0g
Protein 12g 24%
Salt 1.1g 18%`)!;
    expect(r.values).toMatchObject({ energy: 250, fat: 9, satFat: 4, carbs: 30, sugar: 8, fiber: 2, protein: 12, salt: 1.1 });
  });

  it('reads millilitres', () => {
    const r = parseNutritionLabel(`Per 100ml
Energy 180kJ/43kcal
Fat 0g
Carbohydrate 10.6g
of which sugars 10.6g
Protein 0g
Salt 0g`)!;
    expect(r.unit).toBe('ml');
    expect(r.values.energy).toBe(43);
    expect(r.values.sugar).toBe(10.6);
  });

  it('copes with comma decimals, <, trace and OCR letter-for-digit slips', () => {
    const r = parseNutritionLabel(`per 100g
Energy 1 046kJ/250kcal
Fat 9,0g
of which saturates <0.1g
Carbohydrate l2g
of which sugars O.5g
Protein 5g
Salt trace`)!;
    expect(r.values.fat).toBe(9);
    expect(r.values.satFat).toBe(0);
    expect(r.values.carbs).toBe(12);
    expect(r.values.sugar).toBe(0.5);
    expect(r.values.salt).toBe(0);
  });

  it('converts sodium to salt and kJ-only energy to kcal', () => {
    const r = parseNutritionLabel(`per 100g
Energy 836kJ
Protein 10g
Carbohydrate 20g
Fat 3g
Sodium 400mg`)!;
    expect(r.values.energy).toBe(200);
    expect(r.values.salt).toBe(1);
  });

  it('puts "of which" figures on one line in the right rows', () => {
    const r = parseNutritionLabel(`per 100g
Energy 100kcal
Carbohydrate 12g of which sugars 2g
Fat 3g of which saturates 1g
Protein 5g`)!;
    expect(r.values).toMatchObject({ carbs: 12, sugar: 2, fat: 3, satFat: 1, protein: 5 });
  });

  it('ignores mono/polyunsaturates, starch and cholesterol', () => {
    const r = parseNutritionLabel(`per 100g
Energy 100kcal
Fat 3g
of which saturates 1g
mono-unsaturates 1.5g
polyunsaturates 0.5g
Carbohydrate 12g
of which starch 9g
Protein 5g`)!;
    expect(r.values.satFat).toBe(1);
    expect(r.values.fat).toBe(3);
    expect(r.values.carbs).toBe(12);
  });

  it('treats a table with no header as per 100 g', () => {
    const r = parseNutritionLabel(`Energy 100kcal\nFat 3g\nProtein 5g\nCarbohydrate 12g`)!;
    expect(r.basis).toBe('100');
  });
});

describe('warnings', () => {
  it('flags energy that does not match the macros', () => {
    const r = parseNutritionLabel(`per 100g\nEnergy 900kcal\nFat 3g\nCarbohydrate 12g\nProtein 5g`)!;
    expect(r.warnings.join(' ')).toMatch(/don't match the macros/);
  });
  it('flags kJ and kcal that disagree', () => {
    const r = parseNutritionLabel(`per 100g\nEnergy 420kJ/200kcal\nFat 3g\nCarbohydrate 12g\nProtein 5g`)!;
    expect(r.warnings.join(' ')).toMatch(/kJ.*kcal.*agree/);
  });
  it('flags impossible values from a misread photo', () => {
    const r = parseNutritionLabel(`per 100g\nEnergy 100kcal\nFat 3g\nCarbohydrate 120g\nProtein 5g`)!;
    expect(r.warnings.join(' ')).toMatch(/misread/);
  });
  it('warns when there is no energy', () => {
    const r = parseNutritionLabel(`per 100g\nFat 3g\nCarbohydrate 12g\nProtein 5g`)!;
    expect(r.warnings.join(' ')).toMatch(/No energy/);
  });
});

describe('not a nutrition table', () => {
  it('returns null for unrelated text', () => {
    expect(parseNutritionLabel('Best before end: see top of pack. Store in a cool dry place.')).toBeNull();
    expect(parseNutritionLabel('')).toBeNull();
    expect(parseNutritionLabel('Protein 5g')).toBeNull(); // one row is not a table
  });
});
