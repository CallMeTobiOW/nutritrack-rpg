/**
 * Pure maths for the drag ruler picker. A scale runs from `min` to `max` in
 * fixed `step`s, and every step is `px` pixels wide on screen. Values are
 * always snapped to the step grid (counted from `min`) and kept in range.
 */
export interface RulerScale {
  min: number;
  max: number;
  step: number;
  px: number;
}

/** Number of decimal places in a step, e.g. 0.1 → 1, 5 → 0. */
export function stepDecimals(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

/** Whole steps between `min` and the last on-grid value not above `max`. */
export function stepCount({ min, max, step }: Pick<RulerScale, 'min' | 'max' | 'step'>): number {
  return Math.max(0, Math.floor((max - min) / step + 1e-9));
}

/** Snap a value to the nearest step and clamp it to the scale. */
export function snapToScale(value: number, scale: Pick<RulerScale, 'min' | 'max' | 'step'>): number {
  const count = stepCount(scale);
  const n = Math.min(count, Math.max(0, Math.round((value - scale.min) / scale.step)));
  return Number((scale.min + n * scale.step).toFixed(stepDecimals(scale.step)));
}

/** Scroll offset (px) that puts `value` under the centre marker. */
export function offsetForValue(value: number, scale: RulerScale): number {
  const snapped = snapToScale(value, scale);
  return Math.round((snapped - scale.min) / scale.step) * scale.px;
}

/** Value under the centre marker for a scroll offset (px). */
export function valueForOffset(offset: number, scale: RulerScale): number {
  return snapToScale(scale.min + (offset / scale.px) * scale.step, scale);
}

/**
 * Index (in steps from `min`) of the first tick whose value is a whole
 * multiple of `every` steps, so labels land on round numbers (20, 25, 30…)
 * even when the scale starts at an odd value such as 13.
 */
export function firstAlignedIndex(scale: Pick<RulerScale, 'min' | 'step'>, every: number): number {
  const base = Math.round(scale.min / scale.step);
  return (((every - (base % every)) % every) + every) % every;
}
