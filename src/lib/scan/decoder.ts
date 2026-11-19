/**
 * Barcode reader: ZXing-C++ compiled to WebAssembly (zxing-wasm).
 *
 * It is several times faster than the old JavaScript port and copes better
 * with blur, glare, curved packs and codes held sideways. The .wasm file is
 * bundled with the app (not fetched from a CDN) and precached by the service
 * worker, so scanning works offline.
 */
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import type { ReaderOptions } from 'zxing-wasm/reader';

type ReaderModule = typeof import('zxing-wasm/reader');

let ready: Promise<ReaderModule> | null = null;

const OPTIONS: ReaderOptions = {
  formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'],
  tryHarder: true,
  tryRotate: true,
  tryInvert: false,
  tryDownscale: true,
  maxNumberOfSymbols: 1,
};

/** Load and compile the reader once. Safe to call repeatedly. */
export function loadDecoder(): Promise<ReaderModule> {
  ready ??= import('zxing-wasm/reader')
    .then(async (m) => {
      await m.prepareZXingModule({
        overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
        fireImmediately: true,
      });
      return m;
    })
    .catch((e) => {
      ready = null; // allow a retry
      throw e;
    });
  return ready;
}

/** Read retail barcodes (EAN/UPC) in a frame. Returns the digits of valid reads. */
export async function decodeFrame(image: ImageData): Promise<string[]> {
  const m = await loadDecoder();
  const results = await m.readBarcodes(image, OPTIONS);
  return results.filter((r) => r.isValid && r.text).map((r) => r.text);
}
