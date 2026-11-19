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
import { additiveCode } from './additives';
import { analyseIngredients } from './ingredients';
import type { Food, FoodQuality, NutriScore, Serving } from './models';
import type { MeasureUnit } from './nutrition';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'generic_name',
  'generic_name_en',
  'brands',
  'stores',
  'image_front_small_url',
  'image_front_url',
  'image_url',
  'quantity',
  'product_quantity',
  'product_quantity_unit',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'nutrition_data_per',
  'nutriments',
  'nutriscore_grade',
  'nova_group',
  'states_tags',
  'additives_tags',
  'additives_n',
  'categories_tags',
  'ingredients_text_en',
  'ingredients_text',
].join(',');

/** Bump when parseQuality learns something new, so saved products refresh on their next scan. */
export const QUALITY_VERSION = 3;

/** Identifies the app to Open Food Facts, as their API guidelines ask. No personal data. */
const APP_ID = 'app_name=NutriTrackRPG';

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  generic_name_en?: string;
  brands?: string;
  stores?: string;
  image_front_small_url?: string;
  image_front_url?: string;
  image_url?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutrition_data_per?: string;
  nutriments?: Record<string, unknown>;
  nutriscore_grade?: string;
  nova_group?: number | string;
  states_tags?: string[];
  additives_tags?: string[];
  additives_n?: number | string;
  categories_tags?: string[];
  ingredients_text_en?: string;
  ingredients_text?: string;
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

const UNIT_FACTOR: Record<string, number> = { g: 1, ml: 1, cl: 10, l: 1000, kg: 1000 };

/** Read an amount like "30g", "1 bar (45 g)" or "33 cl" from a label. Returns g/ml. */
export function amountFromText(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/i.exec(text);
  if (!m) return undefined;
  const v = Number(m[1].replace(',', '.')) * UNIT_FACTOR[m[2].toLowerCase()];
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

const MAX_PORTION = 5000;
/** Packs bigger than this (a 1 kg bag of rice) are not eaten in one sitting, so no "whole pack" option. */
const MAX_PACK = 750;
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Portions offered for a product: the label's serving (if any) and the whole
 * pack, unless it is a multipack ("6 x 25 g"), which nobody eats in one go.
 */
export function parseServings(p: OffProduct, unit: MeasureUnit): Serving[] {
  const out: Serving[] = [];
  const qty = num(p.serving_quantity) ?? amountFromText(p.serving_size);
  if (qty && qty > 0 && qty <= MAX_PORTION) {
    const label = p.serving_size?.trim() || `1 serving (${r1(qty)} ${p.serving_quantity_unit ?? unit})`;
    out.push({ label: label.slice(0, 60), amount: r1(qty) });
  }
  const multipack = /\d\s*[x×*]\s*\d/i.test(p.quantity ?? '');
  const packUnit = (p.product_quantity_unit ?? '').toLowerCase();
  const pack = num(p.product_quantity) ?? amountFromText(p.quantity);
  const unitOk = !packUnit || packUnit === unit || (packUnit === 'g' && unit === 'ml') || (packUnit === 'ml' && unit === 'g');
  if (!multipack && unitOk && pack && pack > 0 && pack <= MAX_PACK && !out.some((s) => Math.abs(s.amount - pack) < 1)) {
    out.push({ label: `Whole pack (${r1(pack)} ${unit})`, amount: r1(pack) });
  }
  return out;
}

/** Nutri-Score, NOVA group, completeness, additives and categories, when Open Food Facts knows them. */
export function parseQuality(p: OffProduct): FoodQuality {
  const q: FoodQuality = { v: QUALITY_VERSION };
  const grade = (p.nutriscore_grade ?? '').toLowerCase();
  if (/^[a-e]$/.test(grade)) q.nutriScore = grade as NutriScore;
  const nova = num(p.nova_group);
  if (nova === 1 || nova === 2 || nova === 3 || nova === 4) q.nova = nova;
  if (p.states_tags?.includes('en:nutrition-facts-to-be-completed')) q.incomplete = true;
  const alcohol = num(p.nutriments?.['alcohol_100g']) ?? num(p.nutriments?.['alcohol']);
  if (alcohol !== undefined && alcohol > 0 && alcohol <= 100) q.alcohol = alcohol;
  // additives_n is only set once the ingredients have been analysed; before that, additives are unknown.
  if (num(p.additives_n) !== undefined || (p.additives_tags?.length ?? 0) > 0) {
    q.additives = [...new Set((p.additives_tags ?? []).map(additiveCode).filter((c): c is string => !!c))];
  }
  const fv =
    num(p.nutriments?.['fruits-vegetables-legumes-estimate-from-ingredients_100g']) ??
    num(p.nutriments?.['fruits-vegetables-nuts-estimate-from-ingredients_100g']);
  if (fv !== undefined && fv >= 0 && fv <= 100) q.fruitVeg = fv;
  const cats = (p.categories_tags ?? []).filter((c) => c.startsWith('en:'));
  if (cats.length) q.categories = cats.slice(-4);
  // When Open Food Facts has the ingredients but hasn't analysed them, analyse them here.
  const text = (p.ingredients_text_en || p.ingredients_text || '').trim();
  if (text) {
    q.ingredients = text.slice(0, 3000);
    q.ingredientsFrom = 'off';
    const a = analyseIngredients(text);
    if (a) {
      if (q.additives === undefined) q.additives = a.additives;
      if (q.nova === undefined) {
        q.nova = a.nova;
        q.novaEstimated = true;
      }
      if (a.markers.length) q.markers = a.markers;
    }
  }
  return q;
}

/** English name first (a UK player scanning an imported product), then the product's own language. */
function cleanName(p: OffProduct): string {
  return (p.product_name_en || p.product_name || p.generic_name_en || p.generic_name || '').replace(/\s+/g, ' ').trim();
}

/** "Tesco, Aldi" → ["Tesco", "Aldi"]. Undefined when Open Food Facts lists none. */
export function parseStores(text: string | undefined): string[] | undefined {
  const list = [...new Set((text ?? '').split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 12);
  return list.length ? list : undefined;
}

export function offProductToFood(p: OffProduct, now = Date.now()): Omit<Food, 'id'> | null {
  const name = cleanName(p);
  if (!name && !p.code) return null;
  const unit = detectUnit(p);
  const quality = parseQuality(p);
  return {
    name: name || `Product ${p.code}`,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: p.code,
    stores: parseStores(p.stores),
    imageUrl: p.image_front_small_url || p.image_front_url || p.image_url || undefined,
    source: 'off',
    unit,
    per100: parseNutriments(p.nutriments),
    servings: parseServings(p, unit),
    quality,
    fetchedAt: now,
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

/**
 * Whether a typed code passes its check digit (EAN-8, UPC-E, UPC-A, EAN-13,
 * GTIN-14). Catches typos before they open an unrelated product.
 */
export function isPlausibleBarcode(code: string): boolean {
  if (isValidGtin(code)) return true;
  const upca = code.length === 8 ? upcEToUpcA(code) : null;
  return !!upca && isValidGtin(upca);
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

/** Waits between attempts. Open Food Facts often answers a busy moment with a 503. */
export const RETRY_DELAYS_MS = [600, 1500];

const UNREACHABLE =
  'Open Food Facts did not answer. The service may be busy or your connection may have dropped. Try again in a moment.';

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

async function fetchOnce(url: string, signal?: AbortSignal): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OffError('You are offline. Saved foods are still available.', 'offline');
  }
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    // A 503 without CORS headers also lands here, so do not blame the connection alone.
    throw new OffError(UNREACHABLE, 'network');
  }
  if (res.status === 429) throw new OffError('Open Food Facts is busy. Try again in a minute.', 'rate-limit');
  if (res.status === 404) throw new OffError('Product not found.', 'not-found');
  if (res.status >= 500) throw new OffError(UNREACHABLE, 'network');
  if (!res.ok) throw new OffError(`Open Food Facts error (${res.status}).`, 'network');
  return res.json();
}

/** Fetch JSON, retrying briefly when the service is busy or the request fails in transit. */
async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOnce(url, signal);
    } catch (e) {
      const retryable = e instanceof OffError && e.kind === 'network';
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw e;
      await wait(RETRY_DELAYS_MS[attempt], signal);
    }
  }
}

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Omit<Food, 'id'> | null> {
  for (const candidate of barcodeCandidates(code)) {
    try {
      const data = (await getJson(`${BASE}/api/v2/product/${candidate}.json?lc=en&${APP_ID}&fields=${FIELDS}`, signal)) as {
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

/** A product search URL; `extra` adds filters such as UK_ONLY. */
function searchUrl(q: string, extra: string): string {
  return (
    `${BASE}/cgi/search.pl?action=process&json=1&search_simple=1&page_size=40&sort_by=unique_scans_n&lc=en&${APP_ID}` +
    `&search_terms=${encodeURIComponent(q)}${extra}&fields=${FIELDS}`
  );
}

/** Only products sold in the UK (Open Food Facts country filter). */
const UK_ONLY = '&tagtype_0=countries&tag_contains_0=contains&tag_0=united-kingdom';

async function fetchSearch(url: string, signal?: AbortSignal): Promise<Omit<Food, 'id'>[]> {
  const data = (await getJson(url, signal)) as { products?: OffProduct[] };
  return (data.products ?? []).map((p) => offProductToFood(p)).filter((f): f is Omit<Food, 'id'> => !!f && f.per100.energy !== undefined);
}

/**
 * Search Open Food Facts. UK products are asked for first, and the whole
 * world only fills the gaps, so a UK shopper sees UK supermarket products
 * before an Italian pack of the same name. The caller re-ranks the answer
 * (see foodSearch.ts); here the UK list simply comes first, in OFF's own
 * popularity order. One of the two requests failing is fine as long as the
 * other answers.
 */
export async function searchProducts(query: string, signal?: AbortSignal): Promise<Omit<Food, 'id'>[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [uk, world] = await Promise.allSettled([fetchSearch(searchUrl(q, UK_ONLY), signal), fetchSearch(searchUrl(q, ''), signal)]);
  if (uk.status === 'rejected' && world.status === 'rejected') throw uk.reason;
  const seen = new Set<string>();
  const out: Omit<Food, 'id'>[] = [];
  for (const list of [uk, world]) {
    if (list.status !== 'fulfilled') continue;
    for (const f of list.value) {
      const key = f.barcode ?? `${f.name}|${f.brand}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}

/**
 * Popular products in an Open Food Facts category, e.g. "en:chocolate-bars".
 * `country` narrows to products sold there (UK by default).
 */
export async function searchCategory(category: string, opts: { country?: string | null; signal?: AbortSignal } = {}): Promise<Omit<Food, 'id'>[]> {
  const country = opts.country === undefined ? 'en:united-kingdom' : opts.country;
  const url =
    `${BASE}/api/v2/search?categories_tags=${encodeURIComponent(category)}` +
    (country ? `&countries_tags=${encodeURIComponent(country)}` : '') +
    `&sort_by=unique_scans_n&page_size=40&lc=en&${APP_ID}&fields=${FIELDS}`;
  const data = (await getJson(url, opts.signal)) as { products?: OffProduct[] };
  return (data.products ?? []).map((p) => offProductToFood(p)).filter((f): f is Omit<Food, 'id'> => !!f && f.per100.energy !== undefined);
}
