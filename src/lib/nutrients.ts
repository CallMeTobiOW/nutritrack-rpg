/**
 * Nutrient catalogue: the single source of truth for every nutrient the app
 * understands — its unit, which group it belongs to and how to read it from
 * Open Food Facts.
 *
 * Nutrient values are stored per 100 g (or 100 ml) in the nutrient's own
 * display unit (kcal, g, mg or µg). A nutrient that is absent from a food's
 * record is UNKNOWN — it is never treated as zero.
 */

export type NutrientUnit = 'kcal' | 'g' | 'mg' | 'µg';
export type NutrientGroup = 'energy' | 'macro' | 'detail' | 'vitamin' | 'mineral';

export const NUTRIENT_KEYS = [
  'energy',
  'protein',
  'carbs',
  'fat',
  'fiber',
  'sugar',
  'satFat',
  'vitA',
  'vitC',
  'vitD',
  'vitE',
  'vitK',
  'vitB1',
  'vitB2',
  'vitB3',
  'vitB5',
  'vitB6',
  'vitB7',
  'vitB9',
  'vitB12',
  'calcium',
  'iron',
  'magnesium',
  'zinc',
  'potassium',
  'sodium',
  'phosphorus',
  'selenium',
  'copper',
  'manganese',
  'iodine',
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** Partial map: a missing key means "unknown", never zero. */
export type NutrientValues = Partial<Record<NutrientKey, number>>;

export interface NutrientDef {
  key: NutrientKey;
  label: string;
  short: string;
  unit: NutrientUnit;
  group: NutrientGroup;
  /** Open Food Facts `nutriments` base keys, tried in order. */
  off: string[];
  /** 'limit' nutrients are things to stay under (sodium, sugar, saturated fat). */
  kind: 'target' | 'limit';
  /** Plain-language name shown under the label, e.g. "Thiamin". */
  alias?: string;
}

export const NUTRIENTS: Record<NutrientKey, NutrientDef> = {
  energy: { key: 'energy', label: 'Calories', short: 'kcal', unit: 'kcal', group: 'energy', off: ['energy-kcal'], kind: 'target' },
  protein: { key: 'protein', label: 'Protein', short: 'P', unit: 'g', group: 'macro', off: ['proteins'], kind: 'target' },
  carbs: { key: 'carbs', label: 'Carbohydrates', short: 'C', unit: 'g', group: 'macro', off: ['carbohydrates'], kind: 'target' },
  fat: { key: 'fat', label: 'Fat', short: 'F', unit: 'g', group: 'macro', off: ['fat'], kind: 'target' },
  fiber: { key: 'fiber', label: 'Fibre', short: 'Fibre', unit: 'g', group: 'detail', off: ['fiber'], kind: 'target' },
  sugar: { key: 'sugar', label: 'Sugar', short: 'Sugar', unit: 'g', group: 'detail', off: ['sugars'], kind: 'limit' },
  satFat: { key: 'satFat', label: 'Saturated fat', short: 'Sat. fat', unit: 'g', group: 'detail', off: ['saturated-fat'], kind: 'limit' },

  vitA: { key: 'vitA', label: 'Vitamin A', short: 'A', unit: 'µg', group: 'vitamin', off: ['vitamin-a'], kind: 'target', alias: 'Retinol (RAE)' },
  vitC: { key: 'vitC', label: 'Vitamin C', short: 'C', unit: 'mg', group: 'vitamin', off: ['vitamin-c'], kind: 'target', alias: 'Ascorbic acid' },
  vitD: { key: 'vitD', label: 'Vitamin D', short: 'D', unit: 'µg', group: 'vitamin', off: ['vitamin-d'], kind: 'target', alias: 'Calciferol' },
  vitE: { key: 'vitE', label: 'Vitamin E', short: 'E', unit: 'mg', group: 'vitamin', off: ['vitamin-e'], kind: 'target', alias: 'Tocopherol' },
  vitK: { key: 'vitK', label: 'Vitamin K', short: 'K', unit: 'µg', group: 'vitamin', off: ['vitamin-k', 'phylloquinone'], kind: 'target', alias: 'Phylloquinone' },
  vitB1: { key: 'vitB1', label: 'Vitamin B1', short: 'B1', unit: 'mg', group: 'vitamin', off: ['vitamin-b1'], kind: 'target', alias: 'Thiamin' },
  vitB2: { key: 'vitB2', label: 'Vitamin B2', short: 'B2', unit: 'mg', group: 'vitamin', off: ['vitamin-b2'], kind: 'target', alias: 'Riboflavin' },
  vitB3: { key: 'vitB3', label: 'Vitamin B3', short: 'B3', unit: 'mg', group: 'vitamin', off: ['vitamin-pp', 'vitamin-b3'], kind: 'target', alias: 'Niacin' },
  vitB5: { key: 'vitB5', label: 'Vitamin B5', short: 'B5', unit: 'mg', group: 'vitamin', off: ['pantothenic-acid', 'vitamin-b5'], kind: 'target', alias: 'Pantothenic acid' },
  vitB6: { key: 'vitB6', label: 'Vitamin B6', short: 'B6', unit: 'mg', group: 'vitamin', off: ['vitamin-b6'], kind: 'target', alias: 'Pyridoxine' },
  vitB7: { key: 'vitB7', label: 'Vitamin B7', short: 'B7', unit: 'µg', group: 'vitamin', off: ['biotin', 'vitamin-b7'], kind: 'target', alias: 'Biotin' },
  vitB9: { key: 'vitB9', label: 'Vitamin B9', short: 'B9', unit: 'µg', group: 'vitamin', off: ['vitamin-b9', 'folates', 'folic-acid'], kind: 'target', alias: 'Folate' },
  vitB12: { key: 'vitB12', label: 'Vitamin B12', short: 'B12', unit: 'µg', group: 'vitamin', off: ['vitamin-b12'], kind: 'target', alias: 'Cobalamin' },

  calcium: { key: 'calcium', label: 'Calcium', short: 'Ca', unit: 'mg', group: 'mineral', off: ['calcium'], kind: 'target' },
  iron: { key: 'iron', label: 'Iron', short: 'Fe', unit: 'mg', group: 'mineral', off: ['iron'], kind: 'target' },
  magnesium: { key: 'magnesium', label: 'Magnesium', short: 'Mg', unit: 'mg', group: 'mineral', off: ['magnesium'], kind: 'target' },
  zinc: { key: 'zinc', label: 'Zinc', short: 'Zn', unit: 'mg', group: 'mineral', off: ['zinc'], kind: 'target' },
  potassium: { key: 'potassium', label: 'Potassium', short: 'K', unit: 'mg', group: 'mineral', off: ['potassium'], kind: 'target' },
  sodium: { key: 'sodium', label: 'Sodium', short: 'Na', unit: 'mg', group: 'mineral', off: ['sodium'], kind: 'limit' },
  phosphorus: { key: 'phosphorus', label: 'Phosphorus', short: 'P', unit: 'mg', group: 'mineral', off: ['phosphorus'], kind: 'target' },
  selenium: { key: 'selenium', label: 'Selenium', short: 'Se', unit: 'µg', group: 'mineral', off: ['selenium'], kind: 'target' },
  copper: { key: 'copper', label: 'Copper', short: 'Cu', unit: 'µg', group: 'mineral', off: ['copper'], kind: 'target' },
  manganese: { key: 'manganese', label: 'Manganese', short: 'Mn', unit: 'mg', group: 'mineral', off: ['manganese'], kind: 'target' },
  iodine: { key: 'iodine', label: 'Iodine', short: 'I', unit: 'µg', group: 'mineral', off: ['iodine'], kind: 'target' },
};

export const MACRO_KEYS = ['protein', 'carbs', 'fat'] as const;
export const DETAIL_KEYS = ['fiber', 'sugar', 'satFat'] as const;
export const VITAMIN_KEYS = NUTRIENT_KEYS.filter((k) => NUTRIENTS[k].group === 'vitamin');
export const MINERAL_KEYS = NUTRIENT_KEYS.filter((k) => NUTRIENTS[k].group === 'mineral');
export const MICRO_KEYS = [...VITAMIN_KEYS, ...MINERAL_KEYS];

/** Multiply a unit value into grams (used when reading Open Food Facts). */
export const UNIT_PER_GRAM: Record<Exclude<NutrientUnit, 'kcal'>, number> = {
  g: 1,
  mg: 1_000,
  µg: 1_000_000,
};

/** Format a nutrient amount with sensible precision for its unit. */
export function formatAmount(value: number, unit: NutrientUnit): string {
  const abs = Math.abs(value);
  let digits = 0;
  if (unit === 'kcal') digits = 0;
  else if (abs === 0) digits = 0;
  else if (abs < 1) digits = 2;
  else if (abs < 10) digits = 1;
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function formatNutrient(value: number, key: NutrientKey): string {
  const { unit } = NUTRIENTS[key];
  return `${formatAmount(value, unit)} ${unit}`;
}
