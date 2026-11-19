/**
 * The ten biggest UK supermarkets by grocery market share (Worldpanel by
 * Numerator, 2026). Open Food Facts records who makes a product (`brands`)
 * and where it is sold (`stores`), so those are the only things used to
 * tell supermarkets apart. Nothing here is scraped from a shop's site or app.
 */
import { normalise } from '../lib/foodSearch';

export interface Supermarket {
  id: string;
  label: string;
  /** Open Food Facts tag for the brand (own-brand products) and for the store. */
  brandTag: string;
  storeTag: string;
  /** Matches the shop in normalised brand/store text. */
  match: RegExp;
}

export const SUPERMARKETS: readonly Supermarket[] = [
  { id: 'tesco', label: 'Tesco', brandTag: 'tesco', storeTag: 'tesco', match: /\btesco\b/ },
  { id: 'sainsburys', label: "Sainsbury's", brandTag: 'sainsbury-s', storeTag: 'sainsbury-s', match: /\bsainsbury/ },
  { id: 'asda', label: 'Asda', brandTag: 'asda', storeTag: 'asda', match: /\basda\b/ },
  { id: 'aldi', label: 'Aldi', brandTag: 'aldi', storeTag: 'aldi', match: /\baldi\b/ },
  { id: 'lidl', label: 'Lidl', brandTag: 'lidl', storeTag: 'lidl', match: /\blidl\b/ },
  { id: 'morrisons', label: 'Morrisons', brandTag: 'morrisons', storeTag: 'morrisons', match: /\bmorrisons?\b/ },
  { id: 'coop', label: 'Co-op', brandTag: 'co-op', storeTag: 'co-op', match: /\bco op\b|\bcoop\b|\bco operative\b/ },
  { id: 'waitrose', label: 'Waitrose', brandTag: 'waitrose', storeTag: 'waitrose', match: /\bwaitrose\b/ },
  { id: 'marks', label: 'M&S', brandTag: 'marks-spencer', storeTag: 'marks-spencer', match: /\bmarks (and )?spencer\b|\bm (and )?s\b/ },
  { id: 'iceland', label: 'Iceland', brandTag: 'iceland', storeTag: 'iceland', match: /\biceland\b/ },
];

/** Supermarkets named in a brand and/or a list of stores, in a stable order. */
export function supermarketsOf(food: { brand?: string; stores?: string[] }): Supermarket[] {
  const text = [food.brand ?? '', ...(food.stores ?? [])].map(normalise).join(' | ');
  return SUPERMARKETS.filter((s) => s.match.test(text));
}

/** What to tell the player about where a product comes from: "Tesco own brand", "Sold at Asda, Co-op", or both. */
export function shopLine(food: { brand?: string; stores?: string[] }): string | null {
  const own = supermarketsOf({ brand: food.brand });
  const ownIds = new Set(own.map((s) => s.id));
  const sold = supermarketsOf({ stores: food.stores }).filter((s) => !ownIds.has(s.id));
  const parts: string[] = [];
  if (own.length) parts.push(`${own.map((s) => s.label).join(', ')} own brand`);
  if (sold.length) parts.push(`${own.length ? 'also ' : ''}sold at ${sold.map((s) => s.label).join(', ')}`);
  if (!parts.length) return null;
  const line = parts.join(' · ');
  return line[0].toUpperCase() + line.slice(1);
}
