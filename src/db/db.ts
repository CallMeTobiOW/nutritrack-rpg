/**
 * IndexedDB schema (via Dexie). Data lives only on this device.
 *
 * Versioning: never edit an existing `version(n)` block once released —
 * add `version(n + 1)` with the new schema and an upgrade function instead.
 */
import Dexie, { type EntityTable } from 'dexie';
import type {
  AchievementUnlock,
  BriefingRecord,
  RankMatchRecord,
  DiaryEntry,
  Food,
  Profile,
  Quest,
  SavedMeal,
  Settings,
  WaterEntry,
  WeightEntry,
  XpEvent,
} from '../lib/models';

export class NutriTrackDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  foods!: EntityTable<Food, 'id'>;
  diary!: EntityTable<DiaryEntry, 'id'>;
  meals!: EntityTable<SavedMeal, 'id'>;
  water!: EntityTable<WaterEntry, 'id'>;
  weights!: EntityTable<WeightEntry, 'id'>;
  quests!: EntityTable<Quest, 'id'>;
  xpEvents!: EntityTable<XpEvent, 'id'>;
  achievements!: EntityTable<AchievementUnlock, 'id'>;
  briefings!: EntityTable<BriefingRecord, 'date'>;
  rankMatches!: EntityTable<RankMatchRecord, 'date'>;

  constructor(name = 'nutritrack-rpg') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      settings: 'id',
      foods: 'id, barcode, name, lastUsedAt, updatedAt',
      diary: 'id, date, [date+meal], foodId, createdAt',
      meals: 'id, name, lastUsedAt',
      water: 'id, date, createdAt',
      weights: 'id, date',
      quests: 'id, category, order',
      xpEvents: 'id, kind, date, refId, period',
      achievements: 'id, unlockedAt',
      briefings: 'date',
    });
    // v2: competitive rank matches (one locked result per day).
    this.version(2).stores({ rankMatches: 'date' });
  }
}

export const db = new NutriTrackDB();

export const ALL_TABLES = [
  'profile',
  'settings',
  'foods',
  'diary',
  'meals',
  'water',
  'weights',
  'quests',
  'xpEvents',
  'achievements',
  'briefings',
  'rankMatches',
] as const;

export type TableName = (typeof ALL_TABLES)[number];

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Ask the browser not to evict our data under storage pressure (best effort). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* not supported */
  }
  return false;
}
