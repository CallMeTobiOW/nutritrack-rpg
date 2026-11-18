/**
 * Daily briefing persistence. The first launch of each local day creates a
 * record; the full-screen briefing shows until it is acknowledged.
 */
import { BRIEFING_BY_ID, BRIEFINGS, type Briefing } from '../data/briefings';
import { pickBriefing } from '../lib/briefing';
import type { DateKey } from '../lib/dates';
import type { BriefingRecord } from '../lib/models';
import { db } from './db';
import { DEFAULT_SETTINGS } from './defaults';

export async function ensureTodayBriefing(date: DateKey, random: () => number = Math.random): Promise<BriefingRecord> {
  return db.transaction('rw', db.briefings, db.settings, async () => {
    const existing = await db.briefings.get(date);
    if (existing) return existing;
    const settings = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
    const { briefing, seen } = pickBriefing(settings.seenBriefings, [], random);
    const record: BriefingRecord = {
      date,
      messageId: briefing.id,
      extra: [],
      currentId: briefing.id,
      acknowledged: false,
      shownAt: Date.now(),
    };
    await db.briefings.put(record);
    await db.settings.put({ ...settings, seenBriefings: seen });
    return record;
  });
}

/** "Another briefing": pick a fresh message that has not been shown recently. */
export async function nextBriefing(date: DateKey, random: () => number = Math.random): Promise<Briefing> {
  return db.transaction('rw', db.briefings, db.settings, async () => {
    const record = (await db.briefings.get(date)) ?? (await ensureTodayBriefing(date, random));
    const settings = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
    const exclude = [record.messageId, ...record.extra];
    const { briefing, seen } = pickBriefing(settings.seenBriefings, exclude.length < BRIEFINGS.length ? exclude : [record.currentId], random);
    await db.briefings.put({ ...record, extra: [...record.extra, briefing.id], currentId: briefing.id });
    await db.settings.put({ ...settings, seenBriefings: seen });
    return briefing;
  });
}

export async function acknowledgeBriefing(date: DateKey): Promise<void> {
  const r = await db.briefings.get(date);
  if (r && !r.acknowledged) await db.briefings.put({ ...r, acknowledged: true });
}

export function briefingById(id: string | undefined): Briefing | undefined {
  return id ? BRIEFING_BY_ID.get(id) : undefined;
}
