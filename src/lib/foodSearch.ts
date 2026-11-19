/**
 * Food search ranking, shared by the saved foods, the bundled everyday foods
 * and the Open Food Facts results.
 *
 * The aim: typing "orange" puts an orange first, not a juice, a squash or a
 * chocolate bar. In order of importance a result scores higher when
 *  1. its name IS the search ("Orange" for "orange"),
 *  2. it is a plain food rather than a flavoured/processed product,
 *  3. it starts with the search words,
 *  4. it is short and to the point (fewer extra words),
 *  5. it is something the player already uses or Open Food Facts ranks as popular.
 * Plurals ("oranges") and small typos ("oragne") still match.
 */
import type { FoodSource } from './models';

/** What the ranker needs to know about a food. Saved foods, bundled foods and downloaded products all fit. */
export interface Searchable {
  name: string;
  brand?: string;
  barcode?: string;
  source: FoodSource;
  /** Extra words that should find this food but are not part of its name. */
  aliases?: string;
  useCount?: number;
  favorite?: boolean;
  lastUsedAt?: number;
}

/** Lower-case, accent-free, letters and digits only. */
export function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Simple English singular: oranges → orange, berries → berry, tomatoes → tomato. Same rule on both sides, so it only has to be consistent. */
export function singular(word: string): string {
  if (word.length <= 3 || /\d/.test(word)) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses|oes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

export function tokenise(text: string): string[] {
  const n = normalise(text);
  return n ? n.split(' ').map(singular) : [];
}

/** Edit distance counting a swapped pair of letters as one slip ("oragne" → "orange" = 1). */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
    }
    prev2.length = 0;
    prev2.push(...prev);
    prev = cur;
  }
  return prev[b.length];
}

/** Typos allowed in a word: none for short words, one up to 7 letters, two beyond. */
const allowedTypos = (len: number) => (len < 4 ? 0 : len <= 7 ? 1 : 2);

/**
 * Words that turn a plain food into a different product. "Orange juice" is
 * not what someone typing "orange" wants first, unless they typed "juice" too.
 */
const DESCRIPTORS = new Set(
  (
    'juice drink squash cordial flavour flavoured flavor flavored sauce soup cake biscuit cookie bar jelly jam marmalade sweet candy lolly ' +
    'ice cream smoothie soda fizzy syrup liqueur wine beer cider gin vodka crisp chocolate sorbet pudding pie tart muffin dessert mousse ' +
    'gum gummy pastille spread dressing noodle meal pizza burger sandwich yoghurt yogurt cereal granola muesli shake powder sachet capsule ' +
    'tea coffee scone bun loaf flapjack truffle fudge toffee caramel candle'
  ).split(' '),
);

interface WordMatch {
  /** 0–100 */
  score: number;
}

/** How well one search word matches one name word. */
function wordScore(q: string, w: string, isLast: boolean): number {
  if (q === w) return 100;
  // Prefix: "chick" finds "chicken". Only the word being typed, or long enough words, may be partial.
  if (q.length >= 2 && w.startsWith(q) && (isLast || q.length >= 4)) return 78 - Math.min(w.length - q.length, 12);
  const typos = allowedTypos(q.length);
  if (typos > 0) {
    const d = editDistance(q, w, typos);
    if (d <= typos) return 62 - d * 8;
    // A half-typed word with a slip in it: "oragn" → "orange".
    if (isLast && q.length >= 4) {
      const d2 = editDistance(q, w.slice(0, q.length), 1);
      if (d2 <= 1) return 52;
    }
  }
  return 0;
}

function bestMatch(q: string, words: string[], isLast: boolean): WordMatch {
  let best = 0;
  for (const w of words) best = Math.max(best, wordScore(q, w, isLast));
  return { score: best };
}

/**
 * How well a food answers a search. 0 means "not a match". Higher is better;
 * only the order matters, the numbers have no unit.
 * `position` is the food's place in its source list (Open Food Facts sorts its
 * answers by popularity), used as a gentle tie-break.
 */
export function scoreFood(query: string, food: Searchable, position = 0): number {
  const qNorm = normalise(query);
  if (!qNorm) return 1;

  // A barcode typed in full or in part.
  if (/^\d{4,}$/.test(qNorm.replace(/ /g, ''))) {
    const digits = qNorm.replace(/ /g, '');
    if (food.barcode === digits) return 5000;
    return food.barcode?.includes(digits) ? 3000 : 0;
  }

  const qTokens = tokenise(query);
  const nameTokens = tokenise(food.name);
  const brandTokens = tokenise(food.brand ?? '');
  const aliasTokens = tokenise(food.aliases ?? '');

  let total = 0;
  let nameHits = 0;
  for (let i = 0; i < qTokens.length; i++) {
    const q = qTokens[i];
    const isLast = i === qTokens.length - 1;
    const inName = bestMatch(q, nameTokens, isLast).score;
    const inBrand = bestMatch(q, brandTokens, isLast).score * 0.85;
    const inAlias = bestMatch(q, aliasTokens, isLast).score * 0.6;
    const s = Math.max(inName, inBrand, inAlias);
    if (s === 0) return 0; // Every search word has to be found somewhere.
    if (inName === s) nameHits++;
    total += s;
  }
  let score = total / qTokens.length;

  const qSet = new Set(qTokens);
  const sameWords = nameTokens.length === qSet.size && nameTokens.every((t) => qSet.has(t));
  if (sameWords) score += 400;
  else if (nameTokens[0] && qTokens[0] && wordScore(qTokens[0], nameTokens[0], false) >= 78) score += 120;
  if (normalise(food.name).startsWith(qNorm)) score += 80;
  // The last word of a name is usually what the food IS: "Whole milk" is milk, "Milk chocolate" is chocolate.
  const head = tokenise(food.name.replace(/\(.*?\)/g, ''));
  if (head.length > 1 && qTokens.includes(head[head.length - 1])) score += 100;

  // Short, plain names beat long ones: "Orange" before "Orange and mango flavoured water".
  const extra = Math.max(0, nameTokens.length - Math.max(nameHits, 1));
  score -= Math.min(extra * 14, 70);

  // Flavoured and processed variants: only when the player asked for that kind of thing.
  const asked = new Set(qTokens);
  if (nameTokens.some((t) => DESCRIPTORS.has(t) && !asked.has(t))) score -= 130;

  // Who it comes from.
  if (food.source === 'generic') score += 220;
  if (food.source === 'custom') score += 90;
  score += Math.min((food.useCount ?? 0) * 8, 80);
  if (food.favorite) score += 40;
  if (food.lastUsedAt) score += 20;
  if (food.source === 'off') score += Math.max(0, 24 - position * 0.6);

  return Math.max(score, 1);
}

/** Matching foods, best first. Ties keep their original order. */
export function rankFoods<T extends Searchable>(query: string, foods: readonly T[], limit = 40): T[] {
  return foods
    .map((food, i) => ({ food, i, s: scoreFood(query, food, i) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.food);
}

/**
 * Fix likely typos in a search using words we know ("oragne" → "orange").
 * Words already known, short words and numbers are left alone. Returns the
 * corrected text, or null when nothing needed fixing.
 */
export function correctQuery(query: string, vocabulary: ReadonlySet<string>): string | null {
  const words = normalise(query).split(' ').filter(Boolean);
  let changed = false;
  const fixed = words.map((w) => {
    const s = singular(w);
    if (s.length < 4 || /\d/.test(s) || vocabulary.has(s)) return w;
    const typos = allowedTypos(s.length);
    let best: string | null = null;
    let bestD = typos + 1;
    for (const v of vocabulary) {
      const d = editDistance(s, v, typos);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (best && bestD <= typos) {
      changed = true;
      return best;
    }
    return w;
  });
  return changed ? fixed.join(' ') : null;
}

/** Every word used by the given names and aliases, in singular form. */
export function vocabularyOf(items: readonly Pick<Searchable, 'name' | 'aliases' | 'brand'>[]): Set<string> {
  const v = new Set<string>();
  for (const it of items) for (const t of tokenise(`${it.name} ${it.aliases ?? ''} ${it.brand ?? ''}`)) if (t.length >= 3) v.add(t);
  return v;
}
