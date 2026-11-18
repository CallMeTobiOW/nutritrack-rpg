// Renders the PNG app icons from scripts/icon.svg.mjs using Playwright.
// Usage: node scripts/generate-icons.mjs   (only needed if the artwork changes)
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { iconSvg } from './icon.svg.mjs';

// Playwright is a dev tool, not a project dependency: resolve it from wherever it is installed.
const { chromium } = createRequire(import.meta.url)('playwright');

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('favicon.svg', out), iconSvg({ size: 64, rounded: true }));

const targets = [
  { file: 'icons/icon-192.png', size: 192, scale: 0.92 },
  { file: 'icons/icon-512.png', size: 512, scale: 0.92 },
  { file: 'icons/icon-maskable-512.png', size: 512, scale: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.86 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:#05070e">${iconSvg({ size: t.size, scale: t.scale })}</body></html>`);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: t.size, height: t.size }, omitBackground: false });
  writeFileSync(new URL(t.file, out), buf);
  console.log('wrote', t.file);
}
await browser.close();
