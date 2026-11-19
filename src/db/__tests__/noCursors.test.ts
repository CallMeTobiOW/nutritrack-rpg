/**
 * iOS Safari can fail IndexedDB cursors with "UnknownError: Unable to open
 * cursor" while plain get/getAll reads keep working. The app must therefore
 * never depend on a cursor: these tests make every cursor throw and run the
 * everyday flows, and scan the source for Dexie calls that open cursors.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../db';
import { addDiaryEntry, addWater, createQuest, deleteWeight, ensureInitialized, logWeight, saveProfile, toggleQuest, updateWeight } from '../actions';
import { syncProgression } from '../progression';
import type { Food } from '../../lib/models';

const sources = [IDBObjectStore.prototype, IDBIndex.prototype] as unknown as Record<string, unknown>[];
const saved = new Map<Record<string, unknown>, Record<string, unknown>>();

beforeAll(async () => {
  for (const proto of sources) {
    saved.set(proto, { openCursor: proto.openCursor, openKeyCursor: proto.openKeyCursor, getAllRecords: proto.getAllRecords });
    // Like iOS 18: no IndexedDB 3 getAllRecords, so Dexie falls back to cursors for reverse/unique/key reads.
    delete proto.getAllRecords;
    const fail = () => {
      throw new DOMException('Unable to open cursor', 'UnknownError');
    };
    proto.openCursor = fail;
    proto.openKeyCursor = fail;
  }
  db.close();
  await db.delete();
  await db.open();
});

afterAll(() => {
  for (const [proto, fns] of saved) for (const [k, v] of Object.entries(fns)) if (v) proto[k] = v;
});

const food: Food = {
  id: 'oats',
  name: 'Oats',
  source: 'custom',
  unit: 'g',
  per100: { energy: 380, protein: 13, carbs: 60, fat: 7, fiber: 10 },
  servings: [],
  favorite: false,
  useCount: 0,
  createdAt: 0,
  updatedAt: 0,
};

describe('everyday flows work without IndexedDB cursors', () => {
  it('cursors really are broken in this test', async () => {
    await expect(db.quests.orderBy('order').last()).rejects.toThrow(/Unable to open cursor/);
  });

  it('start-up, onboarding, logging, quests and weigh-ins', async () => {
    const today = '2026-11-19';
    await ensureInitialized();
    await syncProgression({ silent: true, today });
    await saveProfile({ name: 'Test', sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', objective: 'maintain' }, { onboard: true });
    await addWater(today, 500);
    await addDiaryEntry({ date: today, meal: 'breakfast', food, amount: 50 });
    await logWeight(today, 79.5);
    await logWeight('2026-11-18', 80);
    const w = (await db.weights.where('date').equals('2026-11-18').toArray())[0];
    await updateWeight(w.id, { kg: 80.2 });
    await deleteWeight(w.id);
    const q = await createQuest({ title: 'Stretch', category: 'daily', recurrence: 'daily', xp: 10 } as never);
    await toggleQuest(q.id, today);
    await syncProgression({ silent: true, today: '2026-11-20' });
    expect(await db.diary.count()).toBe(1);
    expect((await db.profile.get('me'))?.weightKg).toBe(79.5);
  });
});

describe('source never calls cursor-based Dexie APIs on tables', () => {
  const CURSOR_APIS = /\b(uniqueKeys|eachKey|eachPrimaryKey|eachUniqueKey|primaryKeys|keys|last|reverse|each|until|offset|anyOf|anyOfIgnoreCase|noneOf|equalsIgnoreCase|startsWithIgnoreCase|startsWithAnyOf|inAnyRange|modify|or|and)\(/;
  const sourcesByFile = import.meta.glob<string>(['../../**/*.{ts,tsx}', '!../../**/__tests__/**'], { query: '?raw', import: 'default', eager: true });
  const files = Object.keys(sourcesByFile);

  it('scans the app source', () => expect(files.length).toBeGreaterThan(50));

  it.each(files)('%s', (file) => {
    const offenders = sourcesByFile[file]
      .split('\n')
      .filter((line) => /\bdb\.\w+\.(where|orderBy|toCollection|filter|limit|reverse)\(/.test(line) && CURSOR_APIS.test(line.slice(line.indexOf('db.'))));
    expect(offenders).toEqual([]);
  });
});
