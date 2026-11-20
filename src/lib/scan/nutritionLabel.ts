/**
 * Turn the text read from a photo of a UK/EU nutrition table into values the
 * custom-food form can show. Pure text work, so it is fully testable.
 *
 * What it handles: "Typical values per 100g | per serving" tables, energy as
 * "1046kJ/250kcal", "of which saturates/sugars", salt or sodium, comma
 * decimals, "<0.5g" and "trace" (counted as 0), the %RI column and the
 * reference-intake footer (ignored), and a header that lists the serving
 * column first.
 *
 * What it will never do is save anything. Reading a photo can slip ("3.0 g"
 * read as "3.09"), so every value goes into the form for the player to check,
 * and `warnings` explains anything that looks off.
 */
import { per100Problem } from '../food';
import type { NutrientValues } from '../nutrients';

export type LabelNutrient = 'energy' | 'protein' | 'carbs' | 'sugar' | 'fat' | 'satFat' | 'fiber' | 'salt';

export interface LabelReading {
  /** Which column the values are from: per 100 g/ml, or per serving. */
  basis: '100' | 'serving';
  /** kcal, and grams for the rest (salt in grams, as on the pack). */
  values: Partial<Record<LabelNutrient, number>>;
  unit: 'g' | 'ml';
  /** The serving the other column was for, e.g. "1/2 pack (200 g)". */
  servingLabel?: string;
  servingAmount?: number;
  warnings: string[];
}

interface Num {
  value: number;
  unit: string;
}

/** OCR slips that turn a digit into a letter: "O.5g" → "0.5g", "l2g" → "12g". */
function fixDigits(line: string): string {
  return line
    .replace(/(?<![A-Za-z])[Oo](?=[.,]?\d)/g, '0')
    .replace(/(\d)[Oo](?![A-Za-z])/g, '$10')
    .replace(/(?<![A-Za-z])[lI](?=\d)/g, '1')
    .replace(/(\d)\s*,\s*(\d)/g, '$1.$2')
    .replace(/[Kk][Jj]/g, 'kJ')
    .replace(/[Kk][Cc][Aa][Ll]/g, 'kcal');
}

/** The numbers on a line with their units, skipping %RI figures and "<" marks. */
function numbersIn(text: string): Num[] {
  const out: Num[] = [];
  const re = /(<|≤)?\s*(\d+(?:\.\d+)?)\s*(kcal|kJ|mg|µg|mcg|g|ml)?\s*(%)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[4]) continue; // 12% = share of reference intake
    const unit = (m[3] ?? '').toLowerCase() === 'kj' ? 'kJ' : (m[3] ?? '').toLowerCase();
    out.push({ value: m[1] ? 0 : Number(m[2]), unit });
  }
  return out;
}

const SKIP_LINE = /reference intake|%\s*ri|\bri\b|adult|of an average|guideline|daily amount|\bgda\b/i;

function nutrientOf(segment: string): LabelNutrient | 'sodium' | null {
  const s = segment.toLowerCase();
  if (/mono|poly|trans|omega|cholesterol|starch|polyol/.test(s)) return null;
  if (/saturat|sat\.? fat/.test(s)) return 'satFat';
  if (/sugar/.test(s)) return 'sugar';
  if (/carbohydrate|carbs?\b|carbohydrates/.test(s)) return 'carbs';
  if (/\bfat\b|lipid/.test(s)) return 'fat';
  if (/fib(re|er)/.test(s)) return 'fiber';
  if (/protein/.test(s)) return 'protein';
  if (/\bsalt\b/.test(s)) return 'salt';
  if (/sodium/.test(s)) return 'sodium';
  if (/energy|calorie|kcal|kj/.test(s)) return 'energy';
  return null;
}

/** "per 100g", "per serving (30 g)", "per 1/2 pack (200g)", "per biscuit (14g)". */
function parseHeader(text: string): { hundredFirst: boolean | null; servingLabel?: string; servingAmount?: number; unit: 'g' | 'ml' } {
  const lower = text.toLowerCase();
  const unit: 'g' | 'ml' = /100\s*ml/.test(lower) && !/100\s*g\b/.test(lower) ? 'ml' : 'g';
  const hundred = /(?:per|\/)\s*100\s*(?:g|ml)/.exec(lower);
  const serving = /per\s+((?:\d+\/\d+\s+|\d+(?:\.\d+)?\s+)?[a-z][a-z ]{0,24}?)\s*\(?\s*(\d+(?:\.\d+)?)\s*(g|ml)\s*\)?/.exec(lower.replace(/per\s*100\s*(?:g|ml)/g, ' '));
  let servingLabel: string | undefined;
  let servingAmount: number | undefined;
  if (serving) {
    servingAmount = Number(serving[2]);
    const name = serving[1].trim().replace(/\s+/g, ' ');
    servingLabel = `${name} (${servingAmount} ${serving[3]})`.replace(/^(\d)/, '$1');
  } else {
    const plain = /per\s+(?:serving|portion)\s*(?:size)?\s*[:(]?\s*(\d+(?:\.\d+)?)\s*(g|ml)/.exec(lower);
    if (plain) {
      servingAmount = Number(plain[1]);
      servingLabel = `1 serving (${servingAmount} ${plain[2]})`;
    }
  }
  let hundredFirst: boolean | null = null;
  if (hundred) {
    const otherIdx = lower.search(/per\s+(?!100)/);
    hundredFirst = otherIdx === -1 ? true : hundred.index < otherIdx;
  } else if (servingAmount !== undefined) hundredFirst = false;
  return { hundredFirst, servingLabel, servingAmount, unit };
}

export function parseNutritionLabel(raw: string): LabelReading | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => fixDigits(l.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim()))
    .filter(Boolean);
  const header = parseHeader(lines.join(' '));

  // Collect, per nutrient, the figures from every column on the line.
  const found = new Map<LabelNutrient | 'sodium', Num[]>();
  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;
    // "Carbohydrate 12g of which sugars 2g" on one line counts as two rows.
    for (const segment of line.split(/\bof\s+wh?ich\b|\(of which\)/i)) {
      const key = nutrientOf(segment);
      if (!key || found.has(key)) continue;
      // Everything before the first figure is the row's name.
      const nums = numbersIn(segment.replace(/^[^\d<≤]*/, ''));
      if (nums.length === 0 && /\b(trace|nil|none)\b/i.test(segment)) nums.push({ value: 0, unit: 'g' });
      if (nums.length) found.set(key, nums);
    }
  }
  if (found.size < 2) return null;

  // Pick the per-100 column: the first number set, unless the serving column comes first.
  const column = header.hundredFirst === false ? 1 : 0;
  const twoColumns = [...found.values()].some((n) => n.length >= (header.hundredFirst === null ? 99 : 2));
  const pick = <T,>(list: T[]): T | undefined => (twoColumns && list.length > column ? list[column] : list[0]);

  const values: LabelReading['values'] = {};
  const warnings: string[] = [];
  const kcalOf = (nums: Num[]): number | undefined => {
    const kcal = nums.filter((n) => n.unit === 'kcal');
    const kj = nums.filter((n) => n.unit === 'kJ');
    const k = pick(kcal);
    if (k) {
      const j = pick(kj);
      if (j && j.value > 0 && Math.abs(j.value / 4.184 - k.value) > Math.max(12, k.value * 0.12)) warnings.push(`The kJ (${j.value}) and kcal (${k.value}) don't agree. Check the energy.`);
      return k.value;
    }
    const j = pick(kj);
    if (j) return Math.round(j.value / 4.184);
    // Energy with no unit read: a lone number is more likely kcal if small, kJ if large.
    const bare = pick(nums.filter((n) => n.unit === ''));
    if (bare) {
      warnings.push('The energy had no unit. Check it is in kcal.');
      return bare.value > 900 ? Math.round(bare.value / 4.184) : bare.value;
    }
    return undefined;
  };
  for (const [key, nums] of found) {
    if (key === 'energy') {
      const e = kcalOf(nums);
      if (e !== undefined) values.energy = e;
    } else if (key === 'sodium') {
      const n = pick(nums);
      if (n && values.salt === undefined) values.salt = Math.round(((n.unit === 'mg' ? n.value / 1000 : n.value) * 2.5) * 100) / 100;
    } else {
      const n = pick(nums.filter((x) => x.unit === 'g' || x.unit === '') as Num[]) ?? pick(nums);
      if (n) values[key] = n.value;
    }
  }
  if (Object.keys(values).length < 2) return null;

  const basis: '100' | 'serving' = header.hundredFirst === false && !twoColumns ? 'serving' : '100';
  const reading: LabelReading = { basis, values, unit: header.unit, servingLabel: header.servingLabel, servingAmount: header.servingAmount, warnings };

  // Sanity checks, the same ones a hand-typed food gets.
  if (basis === '100') {
    const per100: NutrientValues = { ...values, sodium: values.salt === undefined ? undefined : values.salt * 400 };
    delete (per100 as Record<string, unknown>).salt;
    const problem = per100Problem(per100, header.unit);
    if (problem) warnings.push(`${problem} The photo may have been misread.`);
  }
  const v = values;
  if (v.energy !== undefined && (v.protein !== undefined || v.carbs !== undefined || v.fat !== undefined)) {
    const fromMacros = 4 * (v.protein ?? 0) + 4 * (v.carbs ?? 0) + 9 * (v.fat ?? 0) + 2 * (v.fiber ?? 0);
    if (Math.abs(fromMacros - v.energy) > Math.max(25, v.energy * 0.25)) warnings.push(`The calories (${Math.round(v.energy)}) don't match the macros (about ${Math.round(fromMacros)}). Check the numbers against the pack.`);
  }
  if (v.energy === undefined) warnings.push('No energy (kcal) found. It is needed to count towards your calories.');
  return reading;
}
