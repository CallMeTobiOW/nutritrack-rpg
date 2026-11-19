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
  why: string;
}

const SOUTHAMPTON =
  'Artificial colour. UK law makes products with it carry the warning "may have an adverse effect on activity and attention in children".';
const NITRITE = 'Preservative in processed meat. It forms nitrosamines, part of why the WHO classes processed meat as a cause of bowel cancer.';
const SWEETENER = 'Artificial sweetener. Approved as safe within limits, but a hallmark of ultra-processed food.';
const PHOSPHATE = 'Added phosphate. High intakes from additives are linked to strain on the heart and kidneys.';
const SYNTH_COLOUR = 'Synthetic colour, added for looks only.';

export const ADDITIVES: Record<string, AdditiveInfo> = {
  e102: { name: 'Tartrazine (E102)', concern: 'high', why: SOUTHAMPTON },
  e104: { name: 'Quinoline yellow (E104)', concern: 'high', why: SOUTHAMPTON },
  e110: { name: 'Sunset yellow (E110)', concern: 'high', why: SOUTHAMPTON },
  e122: { name: 'Carmoisine (E122)', concern: 'high', why: SOUTHAMPTON },
  e124: { name: 'Ponceau 4R (E124)', concern: 'high', why: SOUTHAMPTON },
  e129: { name: 'Allura red (E129)', concern: 'high', why: SOUTHAMPTON },
  e171: { name: 'Titanium dioxide (E171)', concern: 'high', why: 'White colouring banned in food in the EU since 2022, because damage to DNA could not be ruled out.' },
  e249: { name: 'Potassium nitrite (E249)', concern: 'high', why: NITRITE },
  e250: { name: 'Sodium nitrite (E250)', concern: 'high', why: NITRITE },
  e251: { name: 'Sodium nitrate (E251)', concern: 'high', why: NITRITE },
  e252: { name: 'Potassium nitrate (E252)', concern: 'high', why: NITRITE },

  e951: { name: 'Aspartame (E951)', concern: 'moderate', why: 'Sweetener the WHO cancer agency (IARC) classed as "possibly carcinogenic" in 2023. The safe daily limit was kept.' },
  e950: { name: 'Acesulfame K (E950)', concern: 'moderate', why: SWEETENER },
  e952: { name: 'Cyclamate (E952)', concern: 'moderate', why: SWEETENER },
  e954: { name: 'Saccharin (E954)', concern: 'moderate', why: SWEETENER },
  e955: { name: 'Sucralose (E955)', concern: 'moderate', why: SWEETENER },
  e150c: { name: 'Ammonia caramel (E150c)', concern: 'moderate', why: 'Caramel colour made with ammonia. It can contain 4-MEI, which IARC lists as possibly carcinogenic.' },
  e150d: { name: 'Sulphite ammonia caramel (E150d)', concern: 'moderate', why: 'Caramel colour made with ammonia. It can contain 4-MEI, which IARC lists as possibly carcinogenic.' },
  e320: { name: 'BHA (E320)', concern: 'moderate', why: 'Synthetic antioxidant that IARC lists as possibly carcinogenic.' },
  e321: { name: 'BHT (E321)', concern: 'moderate', why: 'Synthetic antioxidant with mixed safety evidence; some countries restrict it.' },
  e407: { name: 'Carrageenan (E407)', concern: 'moderate', why: 'Thickener linked to gut inflammation in animal and lab studies.' },
  e433: { name: 'Polysorbate 80 (E433)', concern: 'moderate', why: 'Emulsifier that disturbed gut bacteria and the gut lining in studies.' },
  e466: { name: 'Carboxymethylcellulose (E466)', concern: 'moderate', why: 'Emulsifier that disturbed gut bacteria and the gut lining in studies.' },
  e338: { name: 'Phosphoric acid (E338)', concern: 'moderate', why: PHOSPHATE },
  e339: { name: 'Sodium phosphates (E339)', concern: 'moderate', why: PHOSPHATE },
  e340: { name: 'Potassium phosphates (E340)', concern: 'moderate', why: PHOSPHATE },
  e341: { name: 'Calcium phosphates (E341)', concern: 'moderate', why: PHOSPHATE },
  e450: { name: 'Diphosphates (E450)', concern: 'moderate', why: PHOSPHATE },
  e451: { name: 'Triphosphates (E451)', concern: 'moderate', why: PHOSPHATE },
  e452: { name: 'Polyphosphates (E452)', concern: 'moderate', why: PHOSPHATE },

  e127: { name: 'Erythrosine (E127)', concern: 'low', why: SYNTH_COLOUR },
  e131: { name: 'Patent blue (E131)', concern: 'low', why: SYNTH_COLOUR },
  e132: { name: 'Indigo carmine (E132)', concern: 'low', why: SYNTH_COLOUR },
  e133: { name: 'Brilliant blue (E133)', concern: 'low', why: SYNTH_COLOUR },
  e142: { name: 'Green S (E142)', concern: 'low', why: SYNTH_COLOUR },
  e151: { name: 'Brilliant black (E151)', concern: 'low', why: SYNTH_COLOUR },
  e155: { name: 'Brown HT (E155)', concern: 'low', why: SYNTH_COLOUR },
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
