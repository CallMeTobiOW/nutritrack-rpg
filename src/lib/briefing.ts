/**
 * Briefing selection: pick a message that has not been shown in the current
 * cycle. When every message has been seen, the cycle restarts (but never
 * repeats the message shown immediately before).
 */
import { BRIEFINGS, type Briefing } from '../data/briefings';

export interface Pick {
  briefing: Briefing;
  seen: string[];
}

export function pickBriefing(seen: string[], exclude: string[] = [], random: () => number = Math.random, pool: Briefing[] = BRIEFINGS): Pick {
  const seenSet = new Set(seen);
  let candidates = pool.filter((b) => !seenSet.has(b.id) && !exclude.includes(b.id));
  let nextSeen = seen;
  if (candidates.length === 0) {
    const last = seen[seen.length - 1];
    candidates = pool.filter((b) => b.id !== last && !exclude.includes(b.id));
    if (candidates.length === 0) candidates = pool;
    nextSeen = [];
  }
  const briefing = candidates[Math.floor(random() * candidates.length) % candidates.length];
  return { briefing, seen: [...nextSeen, briefing.id] };
}
