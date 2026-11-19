/**
 * Live data hooks. `useLiveQuery` re-renders automatically whenever the
 * underlying IndexedDB tables change, so screens never need manual refresh.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '../db/db';
import { DEFAULT_SETTINGS, defaultProfile } from '../db/defaults';
import { dateRange, toWeekKey, type DateKey } from '../lib/dates';
import type { Profile, Settings, XpEvent } from '../lib/models';
import { computeDayMetrics, type DayMetrics } from '../lib/quests';
import { activeDays, computePlayerStats, dayMetricsFor, totalXp } from '../lib/stats';
import { computeStreak } from '../lib/streaks';
import { buildRankView, pendingDates, scoreDay, type RankView } from '../lib/rank';
import { levelFromXp, rankTitle } from '../lib/xp';

const FALLBACK_PROFILE = defaultProfile(0);

export function useProfile(): Profile {
  return useLiveQuery(() => db.profile.get('me'), []) ?? FALLBACK_PROFILE;
}

/** `undefined` while loading — used to decide whether to show onboarding. */
export function useProfileOrLoading(): Profile | null | undefined {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export function useSettings(): Settings {
  return useLiveQuery(() => db.settings.get('settings'), []) ?? DEFAULT_SETTINGS;
}

export function useDiaryDay(date: DateKey) {
  return useLiveQuery(() => db.diary.where('date').equals(date).sortBy('createdAt'), [date]);
}

export function useWaterDay(date: DateKey) {
  return useLiveQuery(() => db.water.where('date').equals(date).sortBy('createdAt'), [date]);
}

export function useWeights() {
  return useLiveQuery(() => db.weights.orderBy('date').toArray(), []);
}

export function useDayMetrics(date: DateKey): DayMetrics | undefined {
  const diary = useDiaryDay(date);
  const water = useWaterDay(date);
  return useMemo(() => (diary && water ? computeDayMetrics(date, diary, water, []) : undefined), [date, diary, water]);
}

export function useQuests() {
  return useLiveQuery(() => db.quests.orderBy('order').toArray(), []);
}

export function useXpEvents(): XpEvent[] | undefined {
  return useLiveQuery(() => db.xpEvents.toArray(), []);
}

export function useEventMap(): Map<string, XpEvent> | undefined {
  const events = useXpEvents();
  return useMemo(() => (events ? new Map(events.map((e) => [e.id, e])) : undefined), [events]);
}

export function useAchievementUnlocks() {
  return useLiveQuery(() => db.achievements.toArray(), []);
}

export interface PlayerSummary {
  xp: number;
  xpToday: number;
  level: ReturnType<typeof levelFromXp>;
  /** Level title (Initiate, Wayfarer…), not the competitive rank. */
  title: string;
  streak: ReturnType<typeof computeStreak>;
  questsCompleted: number;
}

/** Level, XP and streak for the HUD. */
export function usePlayer(today: DateKey): PlayerSummary | undefined {
  const data = useLiveQuery(async () => {
    // Plain getAll reads only: iOS Safari can fail key cursors ("Unable to open cursor").
    const [events, diary, water] = await Promise.all([db.xpEvents.toArray(), db.diary.toArray(), db.water.toArray()]);
    return { events, diaryDates: [...new Set(diary.map((e) => e.date))], water };
  }, []);
  return useMemo(() => {
    if (!data) return undefined;
    const xp = totalXp(data.events);
    const level = levelFromXp(xp);
    const days = activeDays(
      data.diaryDates.map((date) => ({ date })),
      data.water,
      data.events,
    );
    return {
      xp,
      xpToday: totalXp(data.events.filter((e) => e.date === today)),
      level,
      title: rankTitle(level.level),
      streak: computeStreak(days, today),
      questsCompleted: data.events.filter((e) => e.kind === 'quest').length,
    };
  }, [data, today]);
}

export function useWeekKey(today: DateKey) {
  return toWeekKey(today);
}

/** Lifetime stats for achievements and the player profile. */
export function usePlayerStats(today: DateKey) {
  const profile = useProfile();
  const data = useLiveQuery(async () => {
    const [diary, water, weights, events, foods, quests] = await Promise.all([
      db.diary.toArray(),
      db.water.toArray(),
      db.weights.toArray(),
      db.xpEvents.toArray(),
      db.foods.toArray(),
      db.quests.toArray(),
    ]);
    return { diary, water, weights, events, foods, quests };
  }, []);
  return useMemo(() => (data ? computePlayerStats({ ...data, targets: profile.targets, today }) : undefined), [data, profile.targets, today]);
}

/** Per-day metrics for an inclusive date range (used by trends and statistics). */
export function useRangeMetrics(start: DateKey, end: DateKey) {
  const data = useLiveQuery(async () => {
    const [diary, water, weights] = await Promise.all([
      db.diary.where('date').between(start, end, true, true).toArray(),
      db.water.where('date').between(start, end, true, true).toArray(),
      db.weights.where('date').between(start, end, true, true).toArray(),
    ]);
    return { diary, water, weights };
  }, [start, end]);
  return useMemo(() => {
    if (!data) return undefined;
    return dayMetricsFor(dateRange(start, end), data.diary, data.water, data.weights);
  }, [data, start, end]);
}

export interface RankData extends RankView {
  seasonStart: DateKey;
  seenStep: number | undefined;
}

/** Competitive rank: the locked ladder standing plus a live projection of unlocked days. */
export function useRank(today: DateKey): RankData | undefined {
  const profile = useProfile();
  const data = useLiveQuery(async () => {
    // Plain getAll reads only (iOS cursor bug).
    const [matches, settings] = await Promise.all([db.rankMatches.toArray(), db.settings.get('settings')]);
    const seasonStart = settings?.rankSeasonStart ?? today;
    let lastLocked: DateKey | null = null;
    for (const m of matches) if (!lastLocked || m.date > lastLocked) lastLocked = m.date;
    const dates = pendingDates(seasonStart, lastLocked, today);
    const from = dates[0] ?? today;
    const [diary, water] = await Promise.all([
      db.diary.where('date').between(from, today, true, true).toArray(),
      db.water.where('date').between(from, today, true, true).toArray(),
    ]);
    return { matches, seasonStart, seenStep: settings?.rankSeenStep, dates, diary, water };
  }, [today]);
  return useMemo(() => {
    if (!data) return undefined;
    const metrics = dayMetricsFor(data.dates, data.diary, data.water, []);
    const pending = data.dates.map((d) => scoreDay(metrics.get(d)!, profile.targets));
    return { ...buildRankView(data.matches, pending), seasonStart: data.seasonStart, seenStep: data.seenStep };
  }, [data, profile.targets]);
}
