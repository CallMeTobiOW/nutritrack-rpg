/**
 * Streaks. A day is "active" if you logged food or water, or completed any
 * quest. Today never breaks a streak: until today is active the current
 * streak is counted up to yesterday, so opening the app in the morning
 * never shows a reset.
 */
import { addDays, type DateKey } from './dates';

export interface StreakInfo {
  current: number;
  best: number;
  activeToday: boolean;
}

export function computeStreak(activeDays: Iterable<DateKey>, today: DateKey): StreakInfo {
  const set = new Set(activeDays);
  const activeToday = set.has(today);

  let current = 0;
  for (let k = activeToday ? today : addDays(today, -1); set.has(k); k = addDays(k, -1)) current++;

  let best = 0;
  const sorted = [...set].filter((k) => k <= today).sort();
  let run = 0;
  let prev: DateKey | null = null;
  for (const k of sorted) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return { current, best: Math.max(best, current), activeToday };
}
