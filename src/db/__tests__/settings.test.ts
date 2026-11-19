import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { ensureInitialized } from '../actions';
import { DEFAULT_SETTINGS, OLD_WATER_QUICK_AMOUNTS } from '../defaults';

describe('water quick-add amounts', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('new players get 100 / 250 / 500 ml', async () => {
    await ensureInitialized();
    expect((await db.settings.get('settings'))!.waterQuickAmounts).toEqual([100, 250, 500]);
  });

  it('moves players on the old default buttons to the new ones, keeping other settings', async () => {
    await db.settings.put({ ...DEFAULT_SETTINGS, theme: 'light', waterQuickAmounts: [...OLD_WATER_QUICK_AMOUNTS] });
    await ensureInitialized();
    const s = (await db.settings.get('settings'))!;
    expect(s.waterQuickAmounts).toEqual([100, 250, 500]);
    expect(s.theme).toBe('light');
  });

  it('leaves any other set of amounts alone', async () => {
    await db.settings.put({ ...DEFAULT_SETTINGS, waterQuickAmounts: [200, 400] });
    await ensureInitialized();
    expect((await db.settings.get('settings'))!.waterQuickAmounts).toEqual([200, 400]);
  });
});
