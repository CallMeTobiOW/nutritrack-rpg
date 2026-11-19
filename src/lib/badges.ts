/**
 * Badges: one goal each, climbed on the same ladder as the competitive rank.
 *
 * The model
 * ─────────
 * Every badge keeps its own rating, replayed from the same locked days the
 * rank uses (see rank.ts). A day either hits the badge's goal (a win, 100)
 * or doesn't (a loss, 0; a day with nothing logged is always a loss), and
 * the rating moves exactly like the rank:
 *     Δ = BADGE_K · (hit − expected(rating))
 * The expectation rises with the ladder, so every tier is harder to reach
 * and to hold than the last:
 *     goal hit on ~40% of days settles in Silver, ~50% Gold,
 *     ~65% Diamond, ~75% Master, ~85% Grandmaster, 90%+ Zenith.
 * Badges drop when the goal slips, as Tobi chose, and keep a lifetime peak.
 * XP is paid once per ladder step, the first time it is reached, so slipping
 * and climbing back never pays twice.
 *
 * Everything here is pure: badges are replayed from locked results, so they
 * can be tested and can never drift or be farmed by editing old days.
 */
import type { DateKey } from './dates';
import { DIVISIONS, TIERS, rankFromRating, rankStep, stepRating, type Rank, type RankMatch } from './rank';

export type BadgeId =
  | 'iron-will'
  | 'wellspring'
  | 'deep-roots'
  | 'true-aim'
  | 'balanced-plate'
  | 'three-squares'
  | 'flawless'
  | 'unbroken'
  | 'iron-discipline';

export interface BadgeDef {
  id: BadgeId;
  title: string;
  /** The daily goal, as shown on the badge. */
  goal: string;
  /** Short flavour line. */
  lore: string;
  /** lucide icon name, see components/ui/Icon.tsx */
  icon: string;
  /** Whether a locked day counts as a win for this badge. */
  hit: (m: RankMatch) => boolean;
}

/** A day counts as logged when it has food. Records locked before v0.7 don't store entries, so any goal hit stands in. */
export function dayLogged(m: RankMatch): boolean {
  return m.entries !== undefined ? m.entries > 0 : m.score > 0;
}

/** A score that wins a rank match from Gold up: the bar for Iron Discipline. */
export const DISCIPLINE_SCORE = 70;

export const BADGES: BadgeDef[] = [
  { id: 'iron-will', title: 'Iron Will', goal: 'Reach your protein target', lore: 'Muscle is built one meal at a time.', icon: 'dumbbell', hit: (m) => m.goals.includes('protein') },
  { id: 'wellspring', title: 'Wellspring', goal: 'Reach your water goal', lore: 'A clear head runs on water.', icon: 'droplet', hit: (m) => m.goals.includes('water') },
  { id: 'deep-roots', title: 'Deep Roots', goal: 'Reach your fibre target', lore: 'Strength that starts below the surface.', icon: 'wheat', hit: (m) => m.goals.includes('fiber') },
  { id: 'true-aim', title: 'True Aim', goal: 'Finish within ±10% of your calories', lore: 'Not too little, not too much. Dead centre.', icon: 'target', hit: (m) => m.goals.includes('calorieRange') },
  { id: 'balanced-plate', title: 'Balanced Plate', goal: 'Hit protein, carbs and fat together', lore: 'Every macro in its place.', icon: 'scale', hit: (m) => m.goals.includes('macros') },
  { id: 'three-squares', title: 'Three Squares', goal: 'Log breakfast, lunch and dinner', lore: 'Fuel on schedule, every watch.', icon: 'utensils', hit: (m) => m.goals.includes('logMeals') },
  { id: 'unbroken', title: 'Unbroken', goal: 'Log food', lore: 'The record keeper never misses a day.', icon: 'notebook-pen', hit: dayLogged },
  { id: 'iron-discipline', title: 'Iron Discipline', goal: `Score ${DISCIPLINE_SCORE}+ in your daily match`, lore: 'Good days, stacked high.', icon: 'shield-check', hit: (m) => m.score >= DISCIPLINE_SCORE },
  { id: 'flawless', title: 'Flawless', goal: 'Score a perfect 100', lore: 'Every objective. No exceptions.', icon: 'crown', hit: (m) => m.score >= 100 },
];

export const BADGE_IDS = BADGES.map((b) => b.id);

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

/* ─── Rating ─────────────────────────────────────────────────────────── */

/**
 * Rating swing per day. Lower than the rank's because a badge day is all or
 * nothing: a perfect run reaches Gold in about 16 days and Zenith in about
 * 16 weeks, and a single miss at Diamond costs most of a division.
 */
export const BADGE_K = 100;

/** Ladder steps: Bronze 5 is step 0, Grandmaster 1 is 34, Zenith is 35. */
export const MAX_STEP = (TIERS.length - 1) * DIVISIONS;

export interface BadgeState {
  rating: number;
  /** Highest rating ever held. */
  peak: number;
  shield: number;
  /** Locked days that hit the goal. */
  hits: number;
  days: number;
  /** Current run of consecutive hits. */
  run: number;
  bestRun: number;
}

export const INITIAL_BADGE: BadgeState = { rating: 0, peak: 0, shield: 0, hits: 0, days: 0, run: 0, bestRun: 0 };

/** Apply one day to a badge. */
export function applyBadgeDay(state: BadgeState, hit: boolean): BadgeState {
  const r = stepRating(state, hit ? 100 : 0, BADGE_K);
  const run = hit ? state.run + 1 : 0;
  return {
    rating: r.rating,
    peak: Math.max(state.peak, r.rating),
    shield: r.shield,
    hits: state.hits + (hit ? 1 : 0),
    days: state.days + 1,
    run,
    bestRun: Math.max(state.bestRun, run),
  };
}

/** Replay a badge over matches in date order. */
export function replayBadge(def: BadgeDef, matches: RankMatch[]): BadgeState {
  let s = INITIAL_BADGE;
  for (const m of sortByDate(matches)) s = applyBadgeDay(s, def.hit(m));
  return s;
}

function sortByDate(matches: RankMatch[]): RankMatch[] {
  return [...matches].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** A badge is claimed once its goal has been hit on a locked day; until then it shows as an empty crest. */
export function isClaimed(s: BadgeState): boolean {
  return s.hits > 0;
}

/** Ladder step of a rating (0…35). */
export function stepOf(rating: number): number {
  return rankStep(rankFromRating(rating));
}

/** Lowest rating of a ladder step. */
export function stepFloor(step: number): number {
  return Math.min(MAX_STEP, Math.max(0, step)) * 100;
}

/** Rank-style label for a ladder step: "Gold 3", "Zenith". */
export function stepLabel(step: number): string {
  return rankFromRating(stepFloor(step)).label;
}

/** Wins in a row needed from this rating to reach the next division (0 at Zenith). */
export function winsToNextStep(rating: number): number {
  const step = stepOf(rating);
  if (step >= MAX_STEP) return 0;
  const target = stepFloor(step + 1);
  let r = rating;
  let n = 0;
  let shield = 0;
  while (r < target && n < 1000) {
    const s = stepRating({ rating: r, shield }, 100, BADGE_K);
    r = s.rating;
    shield = s.shield;
    n++;
  }
  return n;
}

/* ─── XP ─────────────────────────────────────────────────────────────── */

/** XP for reaching a ladder step for the first time: 5 a division in Bronze, +5 per tier, 100 for Zenith. */
export function stepXp(step: number): number {
  if (step <= 0) return 0;
  if (step >= MAX_STEP) return 100;
  return 5 + 5 * Math.floor(step / DIVISIONS);
}

/** Total XP for every step from Bronze 4 up to and including `step`. */
export function xpThroughStep(step: number): number {
  let t = 0;
  for (let s = 1; s <= Math.min(step, MAX_STEP); s++) t += stepXp(s);
  return t;
}

/** Deterministic XP ledger id: each badge step pays once, ever. */
export function badgeEventId(id: BadgeId, step: number): string {
  return `badge:${id}:${step}`;
}

/** Steps whose XP is owed: everything from Bronze 4 to the peak (Bronze 5 is the starting step and pays nothing). */
export function earnedSteps(s: BadgeState): number[] {
  const peak = stepOf(s.peak);
  return Array.from({ length: peak }, (_, i) => i + 1);
}

/* ─── Views ──────────────────────────────────────────────────────────── */

export interface BadgeStanding {
  def: BadgeDef;
  /** Official: locked days only. */
  locked: BadgeState;
  /** Locked days plus yesterday and today as they stand. */
  projected: BadgeState;
  rank: Rank;
  peakRank: Rank;
  claimed: boolean;
  /** Today's (unlocked) day hits the goal so far. */
  hitToday: boolean;
}

export function buildBadgeView(locked: RankMatch[], pending: RankMatch[], today: DateKey): BadgeStanding[] {
  const lockedSorted = sortByDate(locked);
  const pendingSorted = sortByDate(pending);
  const todayMatch = pendingSorted.find((m) => m.date === today);
  return BADGES.map((def) => {
    const l = replayBadge(def, lockedSorted);
    let p = l;
    for (const m of pendingSorted) p = applyBadgeDay(p, def.hit(m));
    return {
      def,
      locked: l,
      projected: p,
      rank: rankFromRating(l.rating),
      peakRank: rankFromRating(l.peak),
      claimed: isClaimed(l),
      hitToday: !!todayMatch && def.hit(todayMatch),
    };
  });
}

/* ─── Changes to celebrate ───────────────────────────────────────────── */

/** The step each badge was last shown at (-1 = not yet claimed). */
export type BadgeSeen = Partial<Record<BadgeId, number>>;

export function seenBadgeStep(s: BadgeState): number {
  return isClaimed(s) ? stepOf(s.rating) : -1;
}

export interface BadgeChange {
  id: BadgeId;
  from: number;
  to: number;
  /** claimed: first win; tier: into a new metal (full-screen); division: within a tier (toast); drop: fell. */
  kind: 'claimed' | 'tier' | 'division' | 'drop';
}

const tierOfStep = (step: number) => Math.floor(Math.min(step, MAX_STEP) / DIVISIONS);

/** Compare the current standings with what was last seen. Badges not in `seen` are new to the player and are reported as claimed if they have been. */
export function badgeChanges(states: Record<BadgeId, BadgeState>, seen: BadgeSeen): BadgeChange[] {
  const out: BadgeChange[] = [];
  for (const id of BADGE_IDS) {
    const to = seenBadgeStep(states[id]);
    const from = seen[id] ?? -1;
    if (to === from) continue;
    const kind: BadgeChange['kind'] =
      from === -1 ? 'claimed' : to < from ? 'drop' : tierOfStep(to) > tierOfStep(from) ? 'tier' : 'division';
    out.push({ id, from, to, kind });
  }
  return out;
}
