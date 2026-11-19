/**
 * Barcode resolution: device first, then Open Food Facts, with an inbox for
 * scans that could not be resolved yet.
 *
 *  - A product scanned before is answered from this device instantly (and
 *    offline). Downloaded products older than 30 days are refreshed quietly
 *    in the background, unless the player corrected them.
 *  - A product found online is saved straight away, so the next scan of it
 *    is instant and works without signal, even if it was not logged.
 *  - A scan made offline (or while the service is down) goes to the scan
 *    inbox and is looked up automatically when the connection returns.
 *  - A product no database knows also goes to the inbox, marked "not found",
 *    so it can be added from the label later without rescanning.
 */
import type { Food, PendingScan } from '../lib/models';
import { OffError, QUALITY_VERSION, barcodeCandidates, lookupBarcode } from '../lib/openFoodFacts';
import { db } from './db';
import { DEFAULT_SETTINGS } from './defaults';
import { saveOffFood } from './actions';

export const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const INBOX_MAX = 30;

export type ScanResult =
  | { kind: 'found'; food: Food; from: 'device' | 'online' }
  | { kind: 'notfound'; code: string }
  | { kind: 'queued'; code: string; message: string };

/** True when two scanned codes name the same product (e.g. UPC-A and its EAN-13 form). */
export function sameProduct(a: string, b: string): boolean {
  const ca = barcodeCandidates(a);
  return barcodeCandidates(b).some((c) => ca.includes(c));
}

export async function findSavedFood(code: string): Promise<Food | undefined> {
  for (const c of barcodeCandidates(code)) {
    const rows = await db.foods.where('barcode').equals(c).toArray();
    if (rows.length) return rows.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }
  return undefined;
}

/**
 * Downloaded products are refreshed after 30 days (unless the player
 * corrected the values), and straight away when saved by an older version
 * of the app that knew less about them (e.g. no additives yet). A refresh of
 * a corrected product only updates its scores, never its values.
 */
export function needsRefresh(food: Food, now = Date.now()): boolean {
  if (food.source !== 'off' || !food.barcode) return false;
  if ((food.quality?.v ?? 0) < QUALITY_VERSION) return true;
  return !food.edited && now - (food.fetchedAt ?? food.updatedAt) > STALE_AFTER_MS;
}

async function refreshInBackground(food: Food): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  try {
    const remote = await lookupBarcode(food.barcode!);
    if (remote) await saveOffFood(remote);
  } catch {
    /* keep the saved copy; try again on a later scan */
  }
}

export async function resolveBarcode(code: string, signal?: AbortSignal): Promise<ScanResult> {
  const saved = await findSavedFood(code);
  if (saved) {
    const food: Food = { ...saved, scanned: true, lastScannedAt: Date.now() };
    await db.foods.put(food);
    await removePendingScan(code);
    if (needsRefresh(food)) void refreshInBackground(food);
    return { kind: 'found', food, from: 'device' };
  }
  try {
    const remote = await lookupBarcode(code, signal);
    if (!remote) {
      await addPendingScan(code, 'notfound');
      return { kind: 'notfound', code };
    }
    const food = await saveOffFood(remote, { scanned: true });
    await removePendingScan(code);
    return { kind: 'found', food, from: 'online' };
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    await addPendingScan(code, 'offline');
    const message = e instanceof OffError ? e.message : 'The lookup failed.';
    return { kind: 'queued', code, message };
  }
}

// ───────────────────────────── Scan inbox ─────────────────────────────

async function editInbox(fn: (list: PendingScan[]) => PendingScan[]): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const s = (await db.settings.get('settings')) ?? { ...DEFAULT_SETTINGS };
    const before = s.pendingScans ?? [];
    const after = fn(before);
    if (after === before) return;
    await db.settings.put({ ...s, pendingScans: after });
  });
}

export async function addPendingScan(code: string, status: PendingScan['status'], at = Date.now()): Promise<void> {
  await editInbox((list) => [{ code, at, status }, ...list.filter((p) => !sameProduct(p.code, code))].slice(0, INBOX_MAX));
}

export async function removePendingScan(code: string): Promise<void> {
  await editInbox((list) => (list.some((p) => sameProduct(p.code, code)) ? list.filter((p) => !sameProduct(p.code, code)) : list));
}

/**
 * Look up inbox scans that were made offline. Stops at the first connection
 * problem. Returns how many products were found.
 */
export async function retryPendingScans(signal?: AbortSignal): Promise<number> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 0;
  const s = await db.settings.get('settings');
  const waiting = (s?.pendingScans ?? []).filter((p) => p.status === 'offline');
  let found = 0;
  for (const p of waiting) {
    try {
      const remote = await lookupBarcode(p.code, signal);
      if (remote) {
        await saveOffFood(remote, { scanned: true, scannedAt: p.at });
        await removePendingScan(p.code);
        found++;
      } else {
        await addPendingScan(p.code, 'notfound', p.at);
      }
    } catch {
      break;
    }
  }
  return found;
}
