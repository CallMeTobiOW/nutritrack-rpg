/**
 * Adult daily reference intakes for vitamins and minerals.
 *
 * Source: US National Academies Dietary Reference Intakes (RDA, or AI where
 * no RDA exists), as summarised by the NIH Office of Dietary Supplements
 * fact sheets. Sodium uses the Chronic Disease Risk Reduction intake
 * (2300 mg) and is treated as an upper limit rather than a goal.
 *
 * Values cover adults 19+ and are not suitable for pregnancy, lactation or
 * children. Players can override every value in Settings.
 */
import type { NutrientKey } from './nutrients';

export type Sex = 'male' | 'female';

type Ref = { male: number; female: number } | ((sex: Sex, age: number) => number);

const REFERENCES: Partial<Record<NutrientKey, Ref>> = {
  vitA: { male: 900, female: 700 }, // µg RAE
  vitC: { male: 90, female: 75 }, // mg
  vitD: (_s, age) => (age > 70 ? 20 : 15), // µg
  vitE: { male: 15, female: 15 }, // mg
  vitK: { male: 120, female: 90 }, // µg (AI)
  vitB1: { male: 1.2, female: 1.1 }, // mg
  vitB2: { male: 1.3, female: 1.1 }, // mg
  vitB3: { male: 16, female: 14 }, // mg NE
  vitB5: { male: 5, female: 5 }, // mg (AI)
  vitB6: (sex, age) => (age <= 50 ? 1.3 : sex === 'male' ? 1.7 : 1.5), // mg
  vitB7: { male: 30, female: 30 }, // µg (AI)
  vitB9: { male: 400, female: 400 }, // µg DFE
  vitB12: { male: 2.4, female: 2.4 }, // µg

  calcium: (sex, age) => (age > 70 || (sex === 'female' && age > 50) ? 1200 : 1000), // mg
  iron: (sex, age) => (sex === 'female' && age <= 50 ? 18 : 8), // mg
  magnesium: (sex, age) => (sex === 'male' ? (age <= 30 ? 400 : 420) : age <= 30 ? 310 : 320), // mg
  zinc: { male: 11, female: 8 }, // mg
  potassium: { male: 3400, female: 2600 }, // mg (AI)
  sodium: { male: 2300, female: 2300 }, // mg (CDRR — limit)
  phosphorus: { male: 700, female: 700 }, // mg
  selenium: { male: 55, female: 55 }, // µg
  copper: { male: 900, female: 900 }, // µg
  manganese: { male: 2.3, female: 1.8 }, // mg (AI)
  iodine: { male: 150, female: 150 }, // µg
};

export function referenceIntake(key: NutrientKey, sex: Sex, age: number): number {
  const ref = REFERENCES[key];
  if (!ref) return 0;
  return typeof ref === 'function' ? ref(sex, age) : ref[sex];
}

export const REFERENCE_SOURCE =
  'Adult RDA/AI values from the US National Academies Dietary Reference Intakes (via NIH Office of Dietary Supplements). Sodium is shown as a 2300 mg upper limit.';
