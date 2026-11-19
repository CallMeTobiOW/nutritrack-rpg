/**
 * Additives worth knowing about, keyed by E-number (lower case, as Open
 * Food Facts tags them: "en:e102" → "e102").
 *
 * Kept short and factual: each entry says why it is flagged, based on UK/EU
 * regulation or WHO/IARC classifications. Everything else permitted in the
 * UK is treated as neutral. Levels:
 *  - high: a regulator requires a warning, has banned it, or it is tied to a
 *    known cancer risk.
 *  - moderate: approved, but flagged by IARC or a body of research.
 *  - low: a synthetic colour with no specific warning.
 */
export type AdditiveConcern = 'high' | 'moderate' | 'low';

export interface AdditiveInfo {
  name: string;
  concern: AdditiveConcern;
  /** Plain-English reason it costs points. Cautious where the evidence is mixed. */
  why: string;
  /** Who says so, e.g. "UK FSA" or "WHO (IARC)". */
  source: string;
}

const SOUTHAMPTON =
  'Artificial dye. A 2007 UK study linked it to hyperactivity in some children, so UK law makes products with it carry the warning "may have an adverse effect on activity and attention in children".';
const NITRITE =
  'Preservative used in cured meat. It can form nitrosamines, which are part of why the WHO classes processed meat as a cause of bowel cancer.';
const SWEETENER =
  'Artificial sweetener. Judged safe within daily limits, but the WHO advises against relying on sweeteners to control weight, as studies found no long-term benefit.';
const CARAMEL =
  'Brown colour made with ammonia. It can contain traces of 4-MEI, which the WHO cancer agency lists as "possibly carcinogenic". Amounts in food are within safety limits.';
const GUT =
  'Emulsifier approved as safe, but early studies, mostly in mice, found it disturbed gut bacteria and the gut lining. Research in people is still limited.';
const PHOSPHATE =
  'Added phosphate. EFSA set a combined safe limit in 2019 and noted some people may go over it. High phosphate intakes are linked with heart and kidney problems, mainly in people with kidney disease.';
const SYNTH_COLOUR = 'Synthetic dye, added only to change how the food looks. Approved, with no UK warning label.';

const SRC = { fsa: 'UK FSA', efsa: 'EFSA', iarc: 'WHO (IARC)', who: 'WHO', studies: 'Published studies' };

export const ADDITIVES: Record<string, AdditiveInfo> = {
  e102: { name: 'Tartrazine (E102)', concern: 'high', why: SOUTHAMPTON, source: SRC.fsa },
  e104: { name: 'Quinoline yellow (E104)', concern: 'high', why: SOUTHAMPTON, source: SRC.fsa },
  e110: { name: 'Sunset yellow (E110)', concern: 'high', why: SOUTHAMPTON, source: SRC.fsa },
  e122: { name: 'Carmoisine (E122)', concern: 'high', why: SOUTHAMPTON, source: SRC.fsa },
  e124: { name: 'Ponceau 4R (E124)', concern: 'high', why: SOUTHAMPTON, source: SRC.fsa },
  e129: { name: 'Allura red (E129)', concern: 'high', why: SOUTHAMPTON, source: SRC.fsa },
  e171: {
    name: 'Titanium dioxide (E171)',
    concern: 'high',
    why: 'White colouring. Banned in food in the EU since 2022 because EFSA could not rule out damage to DNA. Still allowed in the UK.',
    source: SRC.efsa,
  },
  e249: { name: 'Potassium nitrite (E249)', concern: 'high', why: NITRITE, source: SRC.iarc },
  e250: { name: 'Sodium nitrite (E250)', concern: 'high', why: NITRITE, source: SRC.iarc },
  e251: { name: 'Sodium nitrate (E251)', concern: 'high', why: NITRITE, source: SRC.iarc },
  e252: { name: 'Potassium nitrate (E252)', concern: 'high', why: NITRITE, source: SRC.iarc },

  e951: {
    name: 'Aspartame (E951)',
    concern: 'moderate',
    why: 'Sweetener the WHO cancer agency classed as "possibly carcinogenic" in 2023, on limited evidence. The WHO kept its safe daily limit, which most people stay well under.',
    source: SRC.iarc,
  },
  e950: { name: 'Acesulfame K (E950)', concern: 'moderate', why: SWEETENER, source: SRC.who },
  e952: { name: 'Cyclamate (E952)', concern: 'moderate', why: SWEETENER, source: SRC.who },
  e954: { name: 'Saccharin (E954)', concern: 'moderate', why: SWEETENER, source: SRC.who },
  e955: { name: 'Sucralose (E955)', concern: 'moderate', why: SWEETENER, source: SRC.who },
  e150c: { name: 'Ammonia caramel (E150c)', concern: 'moderate', why: CARAMEL, source: SRC.iarc },
  e150d: { name: 'Sulphite ammonia caramel (E150d)', concern: 'moderate', why: CARAMEL, source: SRC.iarc },
  e320: {
    name: 'BHA (E320)',
    concern: 'moderate',
    why: 'Synthetic preservative the WHO cancer agency lists as "possibly carcinogenic", based on animal studies. Allowed within limits.',
    source: SRC.iarc,
  },
  e321: {
    name: 'BHT (E321)',
    concern: 'moderate',
    why: 'Synthetic preservative. EFSA set a safe daily limit, but evidence on long-term effects is mixed.',
    source: SRC.efsa,
  },
  e407: {
    name: 'Carrageenan (E407)',
    concern: 'moderate',
    why: 'Seaweed thickener. Some animal and lab studies link it to gut inflammation, and EFSA asked for more safety data in 2018.',
    source: SRC.efsa,
  },
  e433: { name: 'Polysorbate 80 (E433)', concern: 'moderate', why: GUT, source: SRC.studies },
  e466: { name: 'Carboxymethylcellulose (E466)', concern: 'moderate', why: GUT, source: SRC.studies },
  e338: { name: 'Phosphoric acid (E338)', concern: 'moderate', why: PHOSPHATE, source: SRC.efsa },
  e339: { name: 'Sodium phosphates (E339)', concern: 'moderate', why: PHOSPHATE, source: SRC.efsa },
  e340: { name: 'Potassium phosphates (E340)', concern: 'moderate', why: PHOSPHATE, source: SRC.efsa },
  e341: { name: 'Calcium phosphates (E341)', concern: 'moderate', why: PHOSPHATE, source: SRC.efsa },
  e450: { name: 'Diphosphates (E450)', concern: 'moderate', why: PHOSPHATE, source: SRC.efsa },
  e451: { name: 'Triphosphates (E451)', concern: 'moderate', why: PHOSPHATE, source: SRC.efsa },
  e452: { name: 'Polyphosphates (E452)', concern: 'moderate', why: PHOSPHATE, source: SRC.efsa },

  e127: { name: 'Erythrosine (E127)', concern: 'low', why: SYNTH_COLOUR, source: SRC.fsa },
  e131: { name: 'Patent blue (E131)', concern: 'low', why: SYNTH_COLOUR, source: SRC.fsa },
  e132: { name: 'Indigo carmine (E132)', concern: 'low', why: SYNTH_COLOUR, source: SRC.fsa },
  e133: { name: 'Brilliant blue (E133)', concern: 'low', why: SYNTH_COLOUR, source: SRC.fsa },
  e142: { name: 'Green S (E142)', concern: 'low', why: SYNTH_COLOUR, source: SRC.fsa },
  e151: { name: 'Brilliant black (E151)', concern: 'low', why: SYNTH_COLOUR, source: SRC.fsa },
  e155: { name: 'Brown HT (E155)', concern: 'low', why: SYNTH_COLOUR, source: SRC.fsa },
};

/** "en:e322i" → "e322i". Returns null for tags that are not E-numbers. */
export function additiveCode(tag: string): string | null {
  const code = tag.replace(/^[a-z]{2}:/, '').toLowerCase();
  return /^e\d{3,4}[a-z]*$/.test(code) ? code : null;
}

/** Look up an additive, falling back from a sub-type ("e450i") to its family ("e450"). */
export function additiveInfo(code: string): AdditiveInfo | undefined {
  if (ADDITIVES[code]) return ADDITIVES[code];
  const family = /^(e\d{3,4})(?:[a-d])?(?:i{1,3}|iv|v|vi)?$/.exec(code)?.[1];
  return family ? ADDITIVES[family] : undefined;
}
