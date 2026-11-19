/**
 * Reading an ingredients list ourselves: which additives it contains and how
 * processed the food is likely to be.
 *
 * Used when Open Food Facts has the ingredients text but no analysis, and
 * for ingredients the player photographs or types from the pack.
 *
 * The processing estimate follows the NOVA idea: ingredients that are not
 * used in home cooking (flavourings, glucose syrup, modified starch,
 * emulsifiers, sweeteners, colours…) mark a food as ultra-processed.
 */
import { ADDITIVES } from './additives';

/** Additive names (as printed on UK packs) → E-number. Flagged additives plus common neutral ones. */
const NAMES: [RegExp, string][] = [
  [/tartrazine/, 'e102'],
  [/quinoline yellow/, 'e104'],
  [/sunset yellow/, 'e110'],
  [/carmoisine|azorubine/, 'e122'],
  [/ponceau 4r|cochineal red a/, 'e124'],
  [/allura red/, 'e129'],
  [/erythrosine/, 'e127'],
  [/patent blue/, 'e131'],
  [/indigo carmine|indigotine/, 'e132'],
  [/brilliant blue/, 'e133'],
  [/green s\b/, 'e142'],
  [/brilliant black|black pn/, 'e151'],
  [/brown ht/, 'e155'],
  [/titanium dioxide/, 'e171'],
  [/ammonia caramel/, 'e150c'],
  [/sulphite ammonia caramel|sulfite ammonia caramel/, 'e150d'],
  [/potassium nitrite/, 'e249'],
  [/sodium nitrite/, 'e250'],
  [/sodium nitrate/, 'e251'],
  [/potassium nitrate/, 'e252'],
  [/\bbha\b|butylated hydroxyanisole/, 'e320'],
  [/\bbht\b|butylated hydroxytoluene/, 'e321'],
  [/carrageenan/, 'e407'],
  [/polysorbate 80/, 'e433'],
  [/carboxymethyl ?cellulose|cellulose gum/, 'e466'],
  [/phosphoric acid/, 'e338'],
  [/sodium phosphates?/, 'e339'],
  [/potassium phosphates?/, 'e340'],
  [/calcium phosphates?/, 'e341'],
  [/diphosphates?/, 'e450'],
  [/triphosphates?/, 'e451'],
  [/polyphosphates?/, 'e452'],
  [/aspartame/, 'e951'],
  [/acesulfame/, 'e950'],
  [/cyclamate/, 'e952'],
  [/saccharin/, 'e954'],
  [/sucralose/, 'e955'],
  [/steviol glycosides?/, 'e960'],
  [/citric acid/, 'e330'],
  [/ascorbic acid/, 'e300'],
  [/(soya|soy|sunflower) lecithins?|\blecithins?\b/, 'e322'],
  [/mono- ?and di-?glycerides of fatty acids/, 'e471'],
  [/xanthan gum/, 'e415'],
  [/guar gum/, 'e412'],
  [/pectins?\b/, 'e440'],
  [/potassium sorbate/, 'e202'],
  [/sodium benzoate/, 'e211'],
  [/monosodium glutamate/, 'e621'],
  [/sodium bicarbonate|sodium hydrogen carbonate/, 'e500'],
];

/** Ingredients that are not used in home cooking: their presence marks ultra-processing (NOVA 4). */
const ULTRA_MARKERS: [RegExp, string][] = [
  [/flavourings?|flavorings?|\baroma\b/, 'flavouring'],
  [/glucose[- ]fructose syrup|high fructose corn syrup|fructose syrup|glucose syrup|corn syrup/, 'glucose syrup'],
  [/invert(ed)? sugar( syrup)?/, 'invert sugar'],
  [/maltodextrin/, 'maltodextrin'],
  [/\bdextrose\b/, 'dextrose'],
  [/modified (maize |corn |potato |tapioca )?starch/, 'modified starch'],
  [/hydrogenated|interesterified/, 'hydrogenated fat'],
  [/hydrolysed (vegetable |soya |wheat )?protein/, 'hydrolysed protein'],
  [/protein isolate|soya isolate/, 'protein isolate'],
  [/emulsifiers?\b/, 'emulsifier'],
  [/sweeteners?\b/, 'sweetener'],
  [/colours?\b|colors?\b/, 'colour'],
  [/flavour enhancers?/, 'flavour enhancer'],
  [/stabilisers?|stabilizers?|thickeners?/, 'thickener or stabiliser'],
  [/glazing agents?/, 'glazing agent'],
  [/humectants?/, 'humectant'],
  [/mechanically separated/, 'mechanically separated meat'],
];

/** Culinary ingredients (NOVA 2) that turn a whole food into a processed one (NOVA 3) when added. */
const CULINARY = /\b(sugar|salt|oil|butter|vinegar|honey|syrup|cream)\b/;

export interface IngredientAnalysis {
  /** E-numbers found, e.g. ["e129", "e330"]. */
  additives: string[];
  /** Estimated NOVA group. */
  nova: 1 | 3 | 4;
  /** Why it counts as ultra-processed, e.g. ["flavouring", "glucose syrup"]. */
  markers: string[];
}

/** Tidy OCR or typed text: one line, lower case, common OCR slips fixed. */
export function normaliseIngredients(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\r\n]+/g, ' ')
    .replace(/\be[\s-]?(\d{3,4})/g, 'e$1') // "E 102", "E-102" → "e102"
    .replace(/\s+/g, ' ')
    .trim();
}

export function analyseIngredients(text: string): IngredientAnalysis | null {
  const t = normaliseIngredients(text).replace(/^ingredients?\s*:?\s*/, '');
  if (t.length < 3) return null;
  const found = new Set<string>();
  for (const m of t.matchAll(/\be(\d{3,4})([a-d])?(?:\s?\(?(i{1,3}|iv|v)\)?)?\b/g)) {
    const code = `e${m[1]}${m[2] ?? ''}`;
    found.add(ADDITIVES[code] || !m[3] ? code : `${code}${m[3]}`);
  }
  // Longest names first, so "sulphite ammonia caramel" wins over "ammonia caramel".
  for (const [re, code] of [...NAMES].sort((a, b) => b[0].source.length - a[0].source.length)) {
    if (re.test(t) && !(code === 'e150c' && found.has('e150d'))) found.add(code);
  }
  const markers = ULTRA_MARKERS.filter(([re]) => re.test(t)).map(([, label]) => label);
  // Any additive with a cosmetic role (anything bar plain acids/antioxidants) also marks ultra-processing.
  const cosmetic = [...found].some((c) => !['e300', 'e330', 'e290', 'e260', 'e270', 'e500'].includes(c));
  if (cosmetic && !markers.includes('additives')) markers.push('additives');
  const items = t.split(/,|;|\band\b/).filter((s) => s.trim().length > 1);
  const nova: 1 | 3 | 4 = markers.length > 0 ? 4 : items.length > 1 && CULINARY.test(t) ? 3 : 1;
  return { additives: [...found], nova, markers };
}
