import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { addWater, ensureInitialized, logWeight } from '../actions';
import { BackupError, createBackup, restoreBackup, validateBackup, wipeAllData } from '../backup';
import { acknowledgeBriefing, ensureTodayBriefing, nextBriefing } from '../briefing';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureInitialized();
});

describe('backup', () => {
  it('round-trips all data through JSON', async () => {
    await addWater('2026-11-17', 500);
    await logWeight('2026-11-17', 80);
    const backup = JSON.parse(JSON.stringify(await createBackup()));
    await wipeAllData();
    expect(await db.water.count()).toBe(0);
    const summary = await restoreBackup(backup);
    expect(summary.counts.water).toBe(1);
    expect((await db.weights.toArray())[0].kg).toBe(80);
    expect(await db.quests.count()).toBeGreaterThan(0);
  });

  it('rejects files that are not backups', () => {
    expect(() => validateBackup({ hello: 'world' })).toThrow(BackupError);
    expect(() => validateBackup({ app: 'nutritrack-rpg', formatVersion: 99, data: {} })).toThrow(/newer version/);
    expect(() => validateBackup({ app: 'nutritrack-rpg', formatVersion: 1, data: { water: [{ ml: 5 }] } })).toThrow(/invalid record/);
  });

  it('wipe leaves a fresh, usable app', async () => {
    await addWater('2026-11-17', 500);
    await wipeAllData();
    expect(await db.water.count()).toBe(0);
    expect(await db.profile.get('me')).toBeTruthy();
  });
});

describe('daily briefing', () => {
  it('creates one briefing per day and stays until acknowledged', async () => {
    const a = await ensureTodayBriefing('2026-11-17');
    const b = await ensureTodayBriefing('2026-11-17');
    expect(b.messageId).toBe(a.messageId);
    expect(b.acknowledged).toBe(false);
    await acknowledgeBriefing('2026-11-17');
    expect((await db.briefings.get('2026-11-17'))?.acknowledged).toBe(true);
    const tomorrow = await ensureTodayBriefing('2026-11-18');
    expect(tomorrow.messageId).not.toBe(a.messageId);
    expect(tomorrow.acknowledged).toBe(false);
  });

  it('serves fresh messages on request without repeats', async () => {
    const first = await ensureTodayBriefing('2026-11-17');
    const shown = new Set([first.messageId]);
    for (let i = 0; i < 10; i++) {
      const b = await nextBriefing('2026-11-17');
      expect(shown.has(b.id)).toBe(false);
      shown.add(b.id);
    }
    const settings = await db.settings.get('settings');
    expect(settings?.seenBriefings).toHaveLength(11);
  });
});
