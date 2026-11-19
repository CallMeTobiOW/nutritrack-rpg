/**
 * Backup & restore. A backup is a single JSON file containing every table.
 * Restoring REPLACES all current data after validation.
 */
import { ALL_TABLES, db, type TableName } from './db';
import { ensureInitialized } from './actions';
import { syncProgression } from './progression';

export const BACKUP_APP_ID = 'nutritrack-rpg';
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  data: Partial<Record<TableName, unknown[]>>;
}

export async function createBackup(): Promise<BackupFile> {
  const data: Partial<Record<TableName, unknown[]>> = {};
  await db.transaction('r', ALL_TABLES.map((t) => db[t]), async () => {
    for (const t of ALL_TABLES) data[t] = await db[t].toArray();
  });
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: db.verno,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function backupFileName(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `nutritrack-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export class BackupError extends Error {}

const KEY_FIELD: Record<TableName, string> = {
  profile: 'id',
  settings: 'id',
  foods: 'id',
  diary: 'id',
  meals: 'id',
  water: 'id',
  weights: 'id',
  quests: 'id',
  xpEvents: 'id',
  achievements: 'id',
  briefings: 'date',
};

type Row = Record<string, unknown>;
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown) => typeof v === 'string';
const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
const isDay = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v as string);

/**
 * Field checks for the values the app does maths with. A row that fails would
 * otherwise restore "successfully" and then show NaN levels or crash a screen.
 */
const ROW_CHECKS: Record<TableName, (r: Row) => boolean> = {
  profile: (r) =>
    r.id === 'me' && isStr(r.name) && isNum(r.age) && isNum(r.heightCm) && isNum(r.weightKg) &&
    isObj(r.targets) && ['calories', 'protein', 'carbs', 'fat', 'waterMl'].every((k) => isNum((r.targets as Row)[k])),
  settings: (r) => r.id === 'settings',
  foods: (r) => isStr(r.name) && isObj(r.per100),
  diary: (r) => isDay(r.date) && isNum(r.amount) && isObj(r.food) && isObj((r.food as Row).per100),
  meals: (r) => isStr(r.name) && Array.isArray(r.items),
  water: (r) => isDay(r.date) && isNum(r.ml),
  weights: (r) => isDay(r.date) && isNum(r.kg),
  quests: (r) => isStr(r.title) && isNum(r.xp) && ['daily', 'weekly', 'once'].includes(r.recurrence as string),
  xpEvents: (r) => isDay(r.date) && isNum(r.xp) && isStr(r.period),
  achievements: (r) => isDay(r.date),
  briefings: (r) => isDay(r.date),
};

/** Validate the structure of a parsed backup. Throws BackupError with a readable message. */
export function validateBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object') throw new BackupError('This file is not a NutriTrack backup.');
  const b = raw as Partial<BackupFile>;
  if (b.app !== BACKUP_APP_ID) throw new BackupError('This file is not a NutriTrack backup.');
  if (typeof b.formatVersion !== 'number' || b.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Update the app first.');
  }
  if (!b.data || typeof b.data !== 'object') throw new BackupError('The backup contains no data.');
  for (const [table, rows] of Object.entries(b.data)) {
    if (!(ALL_TABLES as readonly string[]).includes(table)) continue; // ignore unknown tables
    if (!Array.isArray(rows)) throw new BackupError(`The "${table}" section is damaged.`);
    const key = KEY_FIELD[table as TableName];
    for (const row of rows) {
      if (!isObj(row) || typeof (row as Row)[key] !== 'string' || !ROW_CHECKS[table as TableName](row as Row)) {
        throw new BackupError(`The "${table}" section contains an invalid record.`);
      }
    }
  }
  // Restoring replaces everything, so a file without a profile would wipe the player.
  const profile = (b.data as Partial<Record<TableName, unknown[]>>).profile;
  if (!Array.isArray(profile) || profile.length === 0) {
    throw new BackupError('This backup has no player profile, so restoring it would erase your data. Nothing was changed.');
  }
  return b as BackupFile;
}

export interface RestoreSummary {
  counts: Partial<Record<TableName, number>>;
}

export async function restoreBackup(raw: unknown): Promise<RestoreSummary> {
  const backup = validateBackup(raw);
  const counts: Partial<Record<TableName, number>> = {};
  await db.transaction('rw', ALL_TABLES.map((t) => db[t]), async () => {
    for (const t of ALL_TABLES) {
      await db[t].clear();
      const rows = backup.data[t];
      if (rows?.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db[t] as any).bulkPut(rows);
        counts[t] = rows.length;
      }
    }
  });
  await ensureInitialized();
  await syncProgression({ silent: true });
  return { counts };
}

/** Permanently delete everything and start fresh. */
export async function wipeAllData(): Promise<void> {
  await db.transaction('rw', ALL_TABLES.map((t) => db[t]), async () => {
    for (const t of ALL_TABLES) await db[t].clear();
  });
  await ensureInitialized();
}

/**
 * Hand the backup to the user. On iPhone the share sheet ("Save to Files")
 * is the most reliable route; elsewhere a normal download is used.
 */
export async function deliverBackup(backup: BackupFile): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const json = JSON.stringify(backup, null, 2);
  const name = backupFileName();
  const file = new File([json], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
    try {
      await nav.share({ files: [file], title: 'NutriTrack backup' });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
