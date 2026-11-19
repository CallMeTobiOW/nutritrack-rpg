/**
 * Read text from a photo (e.g. an ingredients list) with Tesseract.
 *
 * Runs entirely on the phone. The text-recognition engine (~3 MB) and the
 * English language data are downloaded the first time it is used and then
 * cached by the browser, so it needs a connection once. The photo itself is
 * never uploaded anywhere.
 */

/** Longest side for recognition: sharp enough for small print, quick on a phone. */
const MAX_SIDE = 2000;

async function prepare(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // Greyscale with a little extra contrast helps on glossy packs.
    ctx.filter = 'grayscale(1) contrast(1.25)';
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/png'));
  } catch {
    return file;
  }
}

export async function readTextFromImage(file: Blob, onProgress?: (share: number) => void): Promise<string> {
  const image = await prepare(file);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
