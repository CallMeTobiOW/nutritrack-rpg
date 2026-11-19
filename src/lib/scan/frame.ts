/**
 * Pure helpers for preparing camera frames for the barcode reader.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Map the on-screen viewfinder to a crop of the raw video frame.
 *
 * The <video> uses `object-fit: cover`, so the frame is scaled up and its
 * edges are cut off. `view` is the video element's size on screen and `box`
 * is the viewfinder relative to it. The crop is a square around the box
 * (so codes held sideways fit), widened by `margin` (a share of the box
 * side) so a code that pokes outside the frame still reads.
 */
export function cropForViewfinder(
  video: { width: number; height: number },
  view: { width: number; height: number },
  box: Rect,
  margin = 0.25,
): Rect {
  if (video.width <= 0 || video.height <= 0 || view.width <= 0 || view.height <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const scale = Math.max(view.width / video.width, view.height / video.height);
  const offX = (video.width * scale - view.width) / 2;
  const offY = (video.height * scale - view.height) / 2;
  // Read a square around the box: a barcode held upright (bars horizontal)
  // is taller than the box is high, and must still fit in the crop.
  const side = Math.max(box.width, box.height);
  const mx = (side - box.width) / 2 + side * margin;
  const my = (side - box.height) / 2 + side * margin;
  const left = (box.x - mx + offX) / scale;
  const top = (box.y - my + offY) / scale;
  const right = (box.x + box.width + mx + offX) / scale;
  const bottom = (box.y + box.height + my + offY) / scale;
  const x = Math.max(0, Math.floor(left));
  const y = Math.max(0, Math.floor(top));
  return {
    x,
    y,
    width: Math.max(0, Math.min(video.width, Math.ceil(right)) - x),
    height: Math.max(0, Math.min(video.height, Math.ceil(bottom)) - y),
  };
}

/** Size to draw a crop at so the reader gets enough detail without wasting time. */
export function decodeSize(crop: { width: number; height: number }, maxWidth = 1100): { width: number; height: number } {
  if (crop.width <= maxWidth) return { width: crop.width, height: crop.height };
  const f = maxWidth / crop.width;
  return { width: maxWidth, height: Math.round(crop.height * f) };
}

/** Average brightness (0–255) of RGBA pixels, sampling every `step`th pixel. */
export function meanLuma(data: Uint8ClampedArray, step = 16): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 2 < data.length; i += 4 * step) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    n++;
  }
  return n ? sum / n : 0;
}

/** Below this average brightness, barcodes stop reading reliably. */
export const DARK_LUMA = 55;
