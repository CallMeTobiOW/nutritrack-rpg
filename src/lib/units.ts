/** Weight unit conversion. Weights are always STORED in kilograms. */
export type WeightUnit = 'kg' | 'lbs';

export const KG_PER_LB = 0.45359237;

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function formatWeight(kg: number, unit: WeightUnit, digits = 1): string {
  return `${kgToUnit(kg, unit).toFixed(digits)} ${unit}`;
}

/** Height unit for display. Heights are always STORED in centimetres. */
export type HeightUnit = 'cm' | 'ft';

export const CM_PER_IN = 2.54;

/** Split centimetres into whole feet and inches (rounding 11.6″ up to the next foot). */
export function cmToFeetInches(cm: number): { ft: number; inch: number } {
  const total = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(total / 12), inch: total % 12 };
}

/** "178 cm" or "5′ 10″". */
export function formatHeight(cm: number, unit: HeightUnit): string {
  if (unit === 'cm') return `${Math.round(cm)} cm`;
  const { ft, inch } = cmToFeetInches(cm);
  return `${ft}′ ${inch}″`;
}

/** Format millilitres as "750 ml" or "1.25 L". */
export function formatVolume(ml: number): string {
  if (Math.abs(ml) >= 1000) return `${(ml / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;
  return `${Math.round(ml)} ml`;
}
