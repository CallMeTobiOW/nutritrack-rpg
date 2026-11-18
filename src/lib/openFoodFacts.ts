/**
 * Open Food Facts client (https://world.openfoodfacts.org, free & open data).
 *
 * Privacy: the ONLY things ever sent are the barcode you scan/type or the
 * search words you type. No diary, profile or personal data leaves the
 * device. Requests are anonymous (no account, no API key).
 *
 * Data rules:
 *  - `_100g` values from OFF are normalised to grams (energy in kcal/kJ);
 *    we convert to each nutrient's display unit.
 *  - A nutrient OFF does not report stays UNKNOWN (absent), never zero.
 *  - Two standard conversions are applied when the primary field is
 *    missing: kJ → kcal (÷ 4.184) and salt → sodium (× 0.4).
 */
import { NUTRIENT_KEYS, NUTRIENTS, UNIT_PER_GRAM, type NutrientValues } from './nutrients';
import type { Food, Serving } from './models';
import type { MeasureUnit } from './nutrition';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'brands',
  'image_front_small_url',
  'image_front_url',
  'image_url',
  'quantity',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'nutrition_data_per',
  'nutriments',
].join(',');

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_front_url?: string;
  image_url?: string;
  quantity?: string;
  product_quantity_unit?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutrition_data_per?: string;
  nutriments?: Record<string, unknown>;
}

const num = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};

/** Convert OFF `nutriments` into our per-100 map. Missing stays missing. */
export function parseNutriments(n: Record<string, unknown> | undefined): NutrientValues {
  const out: NutrientValues = {};
  if (!n) return out;
  for (const key of NUTRIENT_KEYS) {
    const def = NUTRIENTS[key];
    for (const base of def.off) {
      const raw = num(n[`${base}_100g`]);
      if (raw === undefined || raw < 0) continue;
      // Reject physically impossible values (> 100 g per 100 g, > 1000 kcal per 100 g).
      if (def.unit === 'kcal' ? raw > 1000 : raw > 100) continue;
      out[key] = def.unit === 'kcal' ? raw : raw * UNIT_PER_GRAM[def.unit];
      break;
    }
  }
  if (out.energy === undefined) {
    // `energy_100g` is always normalised to kJ by Open Food Facts.
    const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g']);
    if (kj !== undefined && kj >= 0 && kj <= 4184) out.energy = kj / 4.184;
  }
  if (out.sodium === undefined) {
    const salt = num(n['salt_100g']);
    if (salt !== undefined && salt >= 0 && salt <= 100) out.sodium = salt * 0.4 * 1000;
  }
  return out;
}

function detectUnit(p: OffProduct): MeasureUnit {
  const per = (p.nutrition_data_per ?? '').toLowerCase();
  if (per.includes('ml')) return 'ml';
  const qUnit = (p.product_quantity_unit ?? '').toLowerCase();
  if (qUnit === 'ml') return 'ml';
  if (qUnit === 'g') return 'g';
  const q = (p.quantity ?? '').toLowerCase();
  if (/\d\s*(ml|cl|l)\b/.test(q)) return 'ml';
  return 'g';
}

function parseServing(p: OffProduct): Serving[] {
  const qty = num(p.serving_quantity);
  if (!qty || qty <= 0 || qty > 5000) return [];
  const label = p.serving_size?.trim() || `1 serving (${qty} ${p.serving_quantity_unit ?? 'g'})`;
  return [{ label, amount: qty }];
}

function cleanName(p: OffProduct): string {
  return (p.product_name || p.product_name_en || p.generic_name || '').trim();
}

export function offProductToFood(p: OffProduct, now = Date.now()): Omit<Food, 'id'> | null {
  const name = cleanName(p);
  if (!name && !p.code) return null;
  return {
    name: name || `Product ${p.code}`,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: p.code,
    imageUrl: p.image_front_small_url || p.image_front_url || p.image_url || undefined,
    source: 'off',
    unit: detectUnit(p),
    per100: parseNutriments(p.nutriments),
    servings: parseServing(p),
    favorite: false,
    useCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Strip spaces/dashes from a typed barcode. Returns digits, or null if it cannot be a product code. */
export function normaliseBarcode(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d{6,14}$/.test(digits)) return null;
  return digits;
}

/** GS1 check-digit validation for EAN-8, UPC-A, EAN-13 and GTIN-14. */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Expand a UPC-E (8 digits incl. number system & check) to UPC-A. */
export function upcEToUpcA(upce: string): string | null {
  if (!/^[01]\d{7}$/.test(upce)) return null;
  const ns = upce[0];
  const d = upce.slice(1, 7);
  const check = upce[7];
  const last = d[5];
  let body: string;
  if ('012'.includes(last)) body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === '3') body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === '4') body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  return `${ns}${body}${check}`;
}

/** Barcode variants worth trying against OFF (OFF stores UPC-A as 13-digit EAN). */
export function barcodeCandidates(code: string): string[] {
  const out = new Set<string>([code]);
  if (code.length === 8) {
    const upca = upcEToUpcA(code);
    if (upca) {
      out.add(upca);
      out.add(`0${upca}`);
    }
  }
  if (code.length === 12) out.add(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) out.add(code.slice(1));
  return [...out];
}

export type OffErrorKind = 'offline' | 'network' | 'not-found' | 'rate-limit';

export class OffError extends Error {
  readonly kind: OffErrorKind;
  constructor(message: string, kind: OffErrorKind) {
    super(message);
    this.kind = kind;
  }
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OffError('You are offline. Saved foods are still available.', 'offline');
  }
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new OffError('Could not reach Open Food Facts. Check your connection.', 'network');
  }
  if (res.status === 429) throw new OffError('Open Food Facts is busy. Try again in a minute.', 'rate-limit');
  if (res.status === 404) throw new OffError('Product not found.', 'not-found');
  if (!res.ok) throw new OffError(`Open Food Facts error (${res.status}).`, 'network');
  return res.json();
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Omit<Food, 'id'> | null> {
  for (const candidate of barcodeCandidates(code)) {
    try {
      const data = (await getJson(`${BASE}/api/v2/product/${candidate}.json?fields=${FIELDS}`, signal)) as {
        status?: number;
        product?: OffProduct;
      };
      if (data.status === 1 && data.product) {
        const food = offProductToFood({ ...data.product, code: data.product.code || candidate });
        if (food) return food;
      }
    } catch (e) {
      if (e instanceof OffError && e.kind === 'not-found') continue;
      throw e;
    }
  }
  return null;
}

export async function searchProducts(query: string, signal?: AbortSignal): Promise<Omit<Food, 'id'>[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `${BASE}/cgi/search.pl?action=process&json=1&search_simple=1&page_size=24&sort_by=unique_scans_n` +
    `&search_terms=${encodeURIComponent(q)}&fields=${FIELDS}`;
  const data = (await getJson(url, signal)) as { products?: OffProduct[] };
  return (data.products ?? [])
    .map((p) => offProductToFood(p))
    .filter((f): f is Omit<Food, 'id'> => !!f && f.per100.energy !== undefined);
}
