import { describe, expect, it } from 'vitest';
import { ScanConfirmer } from '../scan/confirm';
import { cropForViewfinder, decodeSize, meanLuma } from '../scan/frame';
import { initialZoom, isMultiLens, rankBackCameras, zoomSteps } from '../scan/cameras';

describe('ScanConfirmer', () => {
  const ean = '5000159484695';

  it('needs two matching reads before accepting a code', () => {
    const c = new ScanConfirmer();
    expect(c.push(ean, 0)).toBeNull();
    expect(c.push(ean, 80)).toBe(ean);
  });

  it('rejects codes that fail the check digit (misreads)', () => {
    const c = new ScanConfirmer();
    expect(c.push('5000159484696', 0)).toBeNull();
    expect(c.push('5000159484696', 50)).toBeNull();
  });

  it('starts over when a different code is read in between', () => {
    const c = new ScanConfirmer();
    c.push(ean, 0);
    c.push('3017620422003', 40);
    expect(c.push(ean, 80)).toBeNull();
    expect(c.push(ean, 120)).toBe(ean);
  });

  it('forgets a lone read once the window passes', () => {
    const c = new ScanConfirmer({ windowMs: 500 });
    c.push(ean, 0);
    expect(c.push(ean, 900)).toBeNull();
    expect(c.push(ean, 950)).toBe(ean);
  });

  it('ignores the same product while it stays in view, but not a new one', () => {
    const c = new ScanConfirmer({ cooldownMs: 2000 });
    c.push(ean, 0);
    expect(c.push(ean, 50)).toBe(ean);
    // Held in view for 5 s: never counted again.
    for (let t = 100; t <= 5000; t += 100) expect(c.push(ean, t)).toBeNull();
    c.push('3017620422003', 5100);
    expect(c.push('3017620422003', 5160)).toBe('3017620422003');
    // Out of view for over 2 s, then scanned again: counts.
    c.push(ean, 7200);
    expect(c.push(ean, 7260)).toBe(ean);
  });

  it('strips anything that is not a digit', () => {
    const c = new ScanConfirmer({ required: 1 });
    expect(c.push(' 5000159484695\n', 0)).toBe(ean);
  });

  it('accepts UPC-E codes', () => {
    const c = new ScanConfirmer({ required: 1 });
    expect(c.push('04252614', 0)).toBe('04252614');
  });
});

describe('cropForViewfinder', () => {
  it('maps the on-screen box into a 16:9 frame shown with object-fit: cover on a tall phone', () => {
    // 1920×1080 video on a 390×844 screen: scaled by 844/1080, sides cut off.
    const crop = cropForViewfinder({ width: 1920, height: 1080 }, { width: 390, height: 844 }, { x: 32, y: 300, width: 326, height: 192 }, 0);
    const scale = 844 / 1080;
    const offX = (1920 * scale - 390) / 2;
    expect(crop.x).toBe(Math.floor((32 + offX) / scale));
    expect(crop.y).toBe(Math.floor((300 - (326 - 192) / 2) / scale));
    expect(crop.width).toBeCloseTo(326 / scale, -1);
    // Square, so an upright barcode fits too.
    expect(crop.height).toBeCloseTo(326 / scale, -1);
  });

  it('adds a margin and clamps it to the frame', () => {
    const crop = cropForViewfinder({ width: 1000, height: 1000 }, { width: 100, height: 100 }, { x: 0, y: 0, width: 100, height: 100 }, 0.25);
    expect(crop).toEqual({ x: 0, y: 0, width: 1000, height: 1000 });
  });

  it('returns an empty crop before the video has a size', () => {
    expect(cropForViewfinder({ width: 0, height: 0 }, { width: 390, height: 844 }, { x: 0, y: 0, width: 10, height: 10 }).width).toBe(0);
  });
});

describe('frame helpers', () => {
  it('limits decode width but keeps the aspect ratio', () => {
    expect(decodeSize({ width: 2200, height: 1100 })).toEqual({ width: 1100, height: 550 });
    expect(decodeSize({ width: 800, height: 400 })).toEqual({ width: 800, height: 400 });
  });

  it('measures brightness', () => {
    const px = (r: number, g: number, b: number, n: number) => new Uint8ClampedArray(Array.from({ length: n }, () => [r, g, b, 255]).flat());
    expect(meanLuma(px(0, 0, 0, 64), 1)).toBe(0);
    expect(meanLuma(px(255, 255, 255, 64), 1)).toBeCloseTo(255);
    expect(meanLuma(new Uint8ClampedArray(0))).toBe(0);
  });
});

describe('camera choice', () => {
  const iphonePro = [
    { deviceId: 'f', label: 'Front Camera' },
    { deviceId: 'w', label: 'Back Camera' },
    { deviceId: 'u', label: 'Back Ultra Wide Camera' },
    { deviceId: 't', label: 'Back Telephoto Camera' },
    { deviceId: 'dw', label: 'Back Dual Wide Camera' },
    { deviceId: '3', label: 'Back Triple Camera' },
  ];

  it('prefers the auto-macro multi-lens camera on an iPhone Pro and drops the front camera', () => {
    expect(rankBackCameras(iphonePro).map((c) => c.deviceId)).toEqual(['3', 'dw', 'w', 'u', 't']);
  });

  it('works with plain Android-style labels and before permission (no labels)', () => {
    expect(rankBackCameras([{ deviceId: 'a', label: 'camera2 1, facing front' }, { deviceId: 'b', label: 'camera2 0, facing back' }])[0].deviceId).toBe('b');
    expect(rankBackCameras([{ deviceId: 'a', label: '' }])).toEqual([]);
  });

  it('knows which cameras are multi-lens', () => {
    expect(isMultiLens('Back Triple Camera')).toBe(true);
    expect(isMultiLens('Back Camera')).toBe(false);
  });

  it('offers 1× and 2× zoom relative to the main lens', () => {
    expect(zoomSteps({ min: 1, max: 10 }, true)).toEqual([
      { label: '1×', value: 2 },
      { label: '2×', value: 4 },
    ]);
    expect(zoomSteps({ min: 1, max: 5 }, false).map((s) => s.value)).toEqual([1, 2]);
    expect(zoomSteps({ min: 1, max: 1.5 }, false)).toEqual([]);
    expect(zoomSteps(undefined, false)).toEqual([]);
    expect(initialZoom({ min: 1, max: 10 }, true)).toBe(2);
    expect(initialZoom({ min: 1, max: 1 }, true)).toBeUndefined();
  });
});
