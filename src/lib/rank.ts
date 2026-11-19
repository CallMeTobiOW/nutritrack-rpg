/**
 * Competitive rank: a ladder of metal tiers earned from how consistently you
 * hit your daily nutrition goals. It is separate from XP and levels: XP only
 * ever goes up, while rank rises and falls with recent performance.
 *
 * The model
 * ─────────
 * Every calendar day is a "match", scored 0–100 from that day's goals
 * (see SCORE_WEIGHTS). A day with nothing logged scores 0 and is a defeat.
 *
 * Each rank expects a minimum score. After a match the rating moves by
 *     Δ = K · (score − expected(rating))
 * so beating your rank's expectation climbs and falling short drops. Because
 * the expectation rises with rank, the rating settles where your typical
 * score equals the expectation: rank measures consistency, not volume, and
 * logging extra food or water can't push it past what your days earn.
 *
 *     expected(r) = 0.30 + 0.60 · r / 3500   (capped at 0.95)
 *     Bronze 5 ≈ 30 · Gold ≈ 48 · Diamond ≈ 72 · Grandmaster ≈ 86–90
 *     A steady 60-point player settles in Platinum, 80 in Master,
 *     and only days averaging 90+ reach Zenith.
 *
 * The first PLACEMENT_MATCHES days are placements: rating is hidden, then
 * set from their average score (capped, so the top tiers are climbed).
 * After promotion to a new tier a short shield stops an immediate drop
 * back out of it.
 *
 * Everything here is pure: the rating is replayed from the stored, locked
 * match results, so it can be tested and can never drift.
 */
import { addDays, type DateKey } from './dates';
import { goalFlags, type DayMetrics, type GoalFlags } from './quests';
import type { Targets } from './targets';

/* ─── Ladder ─────────────────────────────────────────────────────────── */

export type TierId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'grandmaster' | 'zenith';

export interface TierDef {
  id: TierId;
  name: string;
  /** Lowest rating in the tier. */
  floor: number;
  /** Short flavour line for the rank screen. */
  motto: string;
}

export const DIVISION_SIZE = 100;
export const DIVISIONS = 5;
export const TIER_SIZE = DIVISION_SIZE * DIVISIONS; // 500
export const ZENITH_FLOOR = 7 * TIER_SIZE; // 3500

export const TIERS: TierDef[] = [
  { id: 'bronze', name: 'Bronze', floor: 0, motto: 'Every legend starts in the forge.' },
  { id: 'silver', name: 'Silver', floor: 500, motto: 'The routine is taking shape.' },
  { id: 'gold', name: 'Gold', floor: 1000, motto: 'Discipline that holds most days.' },
  { id: 'platinum', name: 'Platinum', floor: 1500, motto: 'Steady hands, steady fuel.' },
  { id: 'diamond', name: 'Diamond', floor: 2000, motto: 'Pressure made you sharper.' },
  { id: 'master', name: 'Master', floor: 2500, motto: 'Few days slip past you.' },
  { id: 'grandmaster', name: 'Grandmaster', floor: 3000, motto: 'Precision, day after day.' },
  { id: 'zenith', name: 'Zenith', floor: ZENITH_FLOOR, motto: 'The summit. Hold it if you can.' },
];

export interface Rank {
  tier: TierDef;
  tierIndex: number;
  /** 5 (lowest) … 1 (highest); null in Zenith, which has no divisions. */
  division: number | null;
  /** Points earned inside the current division (0–99), or above the Zenith floor. */
  progress: number;
  rating: number;
  /** "Gold 3", "Zenith". */
  label: string;
}

export function rankFromRating(rating: number): Rank {
  const r = Math.max(0, Math.floor(rating));
  if (r >= ZENITH_FLOOR) {
    const tier = TIERS[TIERS.length - 1];
    return { tier, tierIndex: TIERS.length - 1, division: null, progress: r - ZENITH_FLOOR, rating: r, label: tier.name };
  }
  const tierIndex = Math.floor(r / TIER_SIZE);
  const within = r - tierIndex * TIER_SIZE;
  const division = DIVISIONS - Math.floor(within / DIVISION_SIZE);
  const tier = TIERS[tierIndex];
  return { tier, tierIndex, division, progress: within % DIVISION_SIZE, rating: r, label: `${tier.name} ${division}` };
}

/** Comparable step on the ladder: one per division, Zenith is the last. */
export function rankStep(rank: Rank): number {
  return rank.division === null ? (TIERS.length - 1) * DIVISIONS : rank.tierIndex * DIVISIONS + (DIVISIONS - rank.division);
}

/* ─── Match scoring ──────────────────────────────────────────────────── */

export type ScoredGoal = keyof GoalFlags;

/** Points per goal; they sum to 100. Calories carry most weight because the range check stops over- and under-eating alike. */
export const SCORE_WEIGHTS: Record<ScoredGoal, number> = {
  calorieRange: 30,
  protein: 20,
  logMeals: 15,
  water: 15,
  fiber: 10,
  macros: 10,
};

export const SCORE_LABELS: Record<ScoredGoal, string> = {
  calorieRange: 'Calories on target',
  protein: 'Protein target',
  logMeals: 'Three meals logged',
  water: 'Water goal',
  fiber: 'Fibre target',
  macros: 'Balanced macros',
};

/** Day score 0–100. A day with nothing logged hits no goals and scores 0. */
export function matchScore(flags: GoalFlags): number {
  let s = 0;
  for (const k of Object.keys(SCORE_WEIGHTS) as ScoredGoal[]) if (flags[k]) s += SCORE_WEIGHTS[k];
  return s;
}

/** Score a day's tracked data as a match. */
export function scoreDay(m: DayMetrics, targets: Targets): RankMatch {
  const flags = goalFlags(m, targets);
  return {
    date: m.date,
    score: matchScore(flags),
    goals: (Object.keys(SCORE_WEIGHTS) as ScoredGoal[]).filter((k) => flags[k]),
    entries: m.entries,
  };
}

/* ─── Rating maths ───────────────────────────────────────────────────── */

export const K_FACTOR = 120;
export const EXPECT_BASE = 0.3;
export const EXPECT_SLOPE = 0.6;
export const EXPECT_MAX = 0.95;
export const PLACEMENT_MATCHES = 5;
/** Placements can reach Platinum 1 at most; the rest of the ladder is climbed. */
export const PLACEMENT_CAP = 1999;
/** Matches after a tier promotion during which you can't fall out of the new tier. */
export const PROMOTION_SHIELD = 3;

/** The score (0–1) a rating expects to hold steady. */
export function expectedScore(rating: number): number {
  return Math.min(EXPECT_MAX, EXPECT_BASE + (EXPECT_SLOPE * Math.max(0, rating)) / ZENITH_FLOOR);
}

/** Rating at which an average score (0–100) holds steady: the inverse of expectedScore. */
export function equilibriumRating(avgScore: number): number {
  return Math.max(0, ((avgScore / 100 - EXPECT_BASE) * ZENITH_FLOOR) / EXPECT_SLOPE);
}

/** Raw rating change for a match, before the floor at 0 and the promotion shield. */
export function ratingDelta(rating: number, score: number): number {
  return Math.round(K_FACTOR * (score / 100 - expectedScore(rating)));
}

/** Score (0–100) needed to gain points at this rating. */
export function breakEvenScore(rating: number): number {
  return Math.ceil(expectedScore(rating) * 100);
}

/* ─── Replay ─────────────────────────────────────────────────────────── */

/** A locked match result as stored in the database. */
export interface RankMatch {
  date: DateKey;
  score: number;
  /** Which goals were hit, for the match history. */
  goals: ScoredGoal[];
  /** Diary entries that day (recorded since v0.7; older records leave it out). */
  entries?: number;
}

export type MatchResult = 'placement' | 'victory' | 'defeat' | 'draw';

export interface MatchOutcome {
  date: DateKey;
  score: number;
  goals: ScoredGoal[];
  result: MatchResult;
  /** Rating change (0 during placements, final placement included). */
  delta: number;
  ratingAfter: number;
  /** True when the promotion shield stopped a drop. */
  shielded: boolean;
  /** Set on the match that changed the rank (incl. the reveal after placements). */
  change: 'placed' | 'promoted' | 'demoted' | null;
}

export interface RankState {
  placed: boolean;
  placementsPlayed: number;
  rating: number;
  /** Highest rating ever held after placements. */
  peak: number;
  shield: number;
  wins: number;
  losses: number;
  /** Current run of consecutive victories (negative for defeats). */
  run: number;
}

export const INITIAL_STATE: RankState = { placed: false, placementsPlayed: 0, rating: 0, peak: 0, shield: 0, wins: 0, losses: 0, run: 0 };

export function applyMatch(
  state: RankState,
  match: RankMatch,
  placementScores: number[],
): { state: RankState; outcome: MatchOutcome } {
  if (!state.placed) {
    const scores = [...placementScores, match.score];
    const played = state.placementsPlayed + 1;
    const done = played >= PLACEMENT_MATCHES;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const rating = done ? Math.min(PLACEMENT_CAP, Math.round(equilibriumRating(avg))) : 0;
    return {
      state: { ...state, placementsPlayed: played, placed: done, rating, peak: done ? rating : 0 },
      outcome: {
        date: match.date,
        score: match.score,
        goals: match.goals,
        result: 'placement',
        delta: 0,
        ratingAfter: rating,
        shielded: false,
        change: done ? 'placed' : null,
      },
    };
  }

  const { rating, shield, shielded, raw, step } = stepRating(state, match.score);
  const result: MatchResult = raw > 0 ? 'victory' : raw < 0 ? 'defeat' : 'draw';

  return {
    state: {
      ...state,
      rating,
      peak: Math.max(state.peak, rating),
      shield,
      wins: state.wins + (result === 'victory' ? 1 : 0),
      losses: state.losses + (result === 'defeat' ? 1 : 0),
      run: result === 'victory' ? Math.max(0, state.run) + 1 : result === 'defeat' ? Math.min(0, state.run) - 1 : 0,
    },
    outcome: {
      date: match.date,
      score: match.score,
      goals: match.goals,
      result,
      delta: rating - state.rating,
      ratingAfter: rating,
      shielded,
      change: step > 0 ? 'promoted' : step < 0 ? 'demoted' : null,
    },
  };
}

/**
 * One rated step on the ladder, shared by the competitive rank and badges:
 * Δ = k · (score − expected), floored at 0, with the promotion shield
 * stopping a drop out of a tier that was only just reached.
 */
export function stepRating(
  cur: { rating: number; shield: number },
  score: number,
  k = K_FACTOR,
): { rating: number; shield: number; shielded: boolean; raw: number; step: number } {
  const before = rankFromRating(cur.rating);
  const raw = Math.round(k * (score / 100 - expectedScore(cur.rating)));
  let rating = Math.max(0, cur.rating + raw);
  let shielded = false;
  if (raw < 0 && cur.shield > 0 && rating < before.tier.floor) {
    rating = before.tier.floor;
    shielded = true;
  }
  const after = rankFromRating(rating);
  const shield = after.tierIndex > before.tierIndex ? PROMOTION_SHIELD : Math.max(0, cur.shield - 1);
  return { rating, shield, shielded, raw, step: rankStep(after) - rankStep(before) };
}

export interface RankHistory {
  state: RankState;
  outcomes: MatchOutcome[];
}

/** Replay locked matches in date order. */
export function replayMatches(matches: RankMatch[]): RankHistory {
  const sorted = [...matches].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let state = INITIAL_STATE;
  const placementScores: number[] = [];
  const outcomes: MatchOutcome[] = [];
  for (const m of sorted) {
    const wasPlacement = !state.placed;
    const r = applyMatch(state, m, placementScores);
    if (wasPlacement) placementScores.push(m.score);
    state = r.state;
    outcomes.push(r.outcome);
  }
  return { state, outcomes };
}

/** Ladder step to remember as "seen": -1 while placements are running. */
export function seenStep(state: RankState): number {
  return state.placed ? rankStep(rankFromRating(state.rating)) : -1;
}

/** What today's (unlocked) match would do if it ended with this score. */
export function previewMatch(state: RankState, score: number): { delta: number; breakEven: number } | null {
  if (!state.placed) return null;
  const r = applyMatch(state, { date: '', score, goals: [] }, []);
  return { delta: r.outcome.delta, breakEven: breakEvenScore(state.rating) };
}

/* ─── Locking days ───────────────────────────────────────────────────── */

/**
 * A day's match locks at the end of the following day, so yesterday's log can
 * still be fixed in the morning, but old days can't be edited to farm rank.
 */
export function lockedThrough(today: DateKey): DateKey {
  return addDays(today, -2);
}

/** Days that should be locked now but aren't yet, oldest first. */
export function datesToLock(seasonStart: DateKey, lastLocked: DateKey | null, today: DateKey): DateKey[] {
  const end = lockedThrough(today);
  let d = lastLocked && lastLocked >= seasonStart ? addDays(lastLocked, 1) : seasonStart;
  const out: DateKey[] = [];
  for (; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Days in the season that aren't locked yet (normally yesterday and today), oldest first. */
export function pendingDates(seasonStart: DateKey, lastLocked: DateKey | null, today: DateKey): DateKey[] {
  let d = lastLocked && lastLocked >= seasonStart ? addDays(lastLocked, 1) : seasonStart;
  const out: DateKey[] = [];
  for (; d <= today; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface RankView {
  /** Official standing: locked matches only. */
  locked: RankHistory;
  /** Locked matches plus today's and yesterday's results so far. */
  projected: RankHistory;
  /** Outcomes of the unlocked days, as they stand right now. */
  pending: MatchOutcome[];
}

export function buildRankView(locked: RankMatch[], pending: RankMatch[]): RankView {
  const projected = replayMatches([...locked, ...pending]);
  return { locked: replayMatches(locked), projected, pending: projected.outcomes.slice(projected.outcomes.length - pending.length) };
}
