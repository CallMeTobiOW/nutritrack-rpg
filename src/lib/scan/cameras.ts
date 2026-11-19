/**
 * Choosing the best rear camera for scanning.
 *
 * On iPhone Pro models the plain "Back Camera" (the main wide lens) cannot
 * focus closer than ~20 cm, so a barcode held at a natural distance stays
 * blurry. The virtual multi-lens devices ("Back Triple Camera", "Back Dual
 * Wide Camera") switch to the ultra-wide macro lens automatically when the
 * product is close, which is what native scanners rely on. We prefer those,
 * then any back camera, and avoid front cameras.
 */

export interface CameraInfo {
  deviceId: string;
  label: string;
}

const FRONT = /front|facetime|user|selfie/i;
const RANK: RegExp[] = [/triple/i, /dual wide/i, /dual/i, /back|rear|environment/i];

/** Rear cameras, best first. Labels are empty until camera permission is granted. */
export function rankBackCameras(devices: CameraInfo[]): CameraInfo[] {
  const back = devices.filter((d) => d.label && !FRONT.test(d.label));
  const score = (d: CameraInfo) => {
    // The ultra-wide lens on its own is fish-eyed and low-detail at a distance.
    if (/ultra wide/i.test(d.label) && !/dual|triple/i.test(d.label)) return RANK.length + 1;
    if (/telephoto/i.test(d.label)) return RANK.length + 2;
    const i = RANK.findIndex((r) => r.test(d.label));
    return i === -1 ? RANK.length : i;
  };
  return [...back].sort((a, b) => score(a) - score(b));
}

/** True for the virtual multi-lens devices, which start zoomed out to the ultra-wide view. */
export function isMultiLens(label: string): boolean {
  return /triple|dual wide/i.test(label);
}

/**
 * Zoom steps worth offering. On a multi-lens device zoom 1 is the ultra-wide
 * view, so "1×" for the player is zoom 2 there. Returns the device zoom
 * values with friendly labels, limited to what the camera supports.
 */
export function zoomSteps(range: { min: number; max: number } | undefined, multiLens: boolean): { label: string; value: number }[] {
  if (!range || !(range.max > range.min)) return [];
  const base = multiLens ? 2 : 1;
  const steps = [
    { label: '1×', value: base },
    { label: '2×', value: base * 2 },
  ];
  const fit = steps.filter((s) => s.value >= range.min && s.value <= range.max);
  return fit.length > 1 ? fit : [];
}

/** Starting zoom: the natural 1× view (2 on a multi-lens device), if supported. */
export function initialZoom(range: { min: number; max: number } | undefined, multiLens: boolean): number | undefined {
  if (!range) return undefined;
  const want = multiLens ? 2 : 1;
  return want >= range.min && want <= range.max ? want : undefined;
}
