import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import {
  INITIAL_STATE,
  PLACEMENT_CAP,
  PLACEMENT_MATCHES,
  SCORE_WEIGHTS,
  TIERS,
  ZENITH_FLOOR,
  applyMatch,
  breakEvenScore,
  datesToLock,
  equilibriumRating,
  expectedScore,
  matchScore,
  previewMatch,
  rankFromRating,
  rankStep,
  ratingDelta,
  replayMatches,
  type RankMatch,
  type RankState,
} from '../rank';
import type { GoalFlags } from '../quests';

const ALL: GoalFlags = { calorieRange: true, protein: true, logMeals: true, water: true, fiber: true, macros: true };
const NONE: GoalFlags = { calorieRange: false, protein: false, logMeals: false, water: false, fiber: false, macros: false };

const start = '2026-01-01';
function matches(scores: number[], from = start): RankMatch[] {
  return scores.map((score, i) => ({ date: addDays(from, i), score, goals: [] }));
}
const placed = (rating: number): RankState => ({ ...INITIAL_STATE, placed: true, placementsPlayed: PLACEMENT_MATCHES, rating, peak: rating });

/** Deterministic pseudo-random player: each goal hit with its own probability. */
function simulate(days: number, probs: (day: number) => number[] | null, seed = 7): RankMatch[] {
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const weights = Object.values(SCORE_WEIGHTS);
  return matches(
    Array.from({ length: days }, (_, i) => {
      const p = probs(i);
      return p ? weights.reduce((sum, w, g) => sum + (rand() < p[g] ? w : 0), 0) : 0;
    }),
  );
}
const labelAfter = (m: RankMatch[], day: number) => rankFromRating(replayMatches(m.slice(0, day)).state.rating).label;

describe('ladder', () => {
  it('has seven tiers of five 100-point divisions, then Zenith', () => {
    expect(TIERS.map((t) => t.floor)).toEqual([0, 500, 1000, 1500, 2000, 2500, 3000, 3500]);
    expect(rankFromRating(0).label).toBe('Bronze 5');
    expect(rankFromRating(99).label).toBe('Bronze 5');
    expect(rankFromRating(100).label).toBe('Bronze 4');
    expect(rankFromRating(499).label).toBe('Bronze 1');
    expect(rankFromRating(500).label).toBe('Silver 5');
    expect(rankFromRating(1234)).toMatchObject({ label: 'Gold 3', progress: 34 });
    expect(rankFromRating(3499).label).toBe('Grandmaster 1');
    expect(rankFromRating(3500)).toMatchObject({ label: 'Zenith', division: null, progress: 0 });
    expect(rankFromRating(-50).label).toBe('Bronze 5');
  });

  it('orders ranks by step', () => {
    for (let r = 0; r < 3500; r += 100) expect(rankStep(rankFromRating(r + 100))).toBe(rankStep(rankFromRating(r)) + 1);
  });
});

describe('match score', () => {
  it('weights sum to 100', () => {
    expect(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect(matchScore(ALL)).toBe(100);
    expect(matchScore(NONE)).toBe(0);
    expect(matchScore({ ...NONE, calorieRange: true, protein: true })).toBe(50);
  });
});

describe('rating maths', () => {
  it('expects more from higher ranks', () => {
    expect(expectedScore(0)).toBeCloseTo(0.3);
    expect(expectedScore(ZENITH_FLOOR)).toBeCloseTo(0.9);
    expect(expectedScore(99_999)).toBe(0.95);
    expect(breakEvenScore(0)).toBe(30);
    expect(breakEvenScore(3000)).toBe(82);
  });

  it('equilibrium is the inverse of the expectation', () => {
    for (const r of [0, 700, 1750, 2917, 3500]) expect(expectedScore(equilibriumRating(expectedScore(r) * 100))).toBeCloseTo(expectedScore(r));
    expect(equilibriumRating(60)).toBeCloseTo(1750);
    expect(equilibriumRating(10)).toBe(0);
  });

  it('wins when beating the expectation, loses when below', () => {
    expect(ratingDelta(1000, 100)).toBe(Math.round(120 * (1 - expectedScore(1000))));
    expect(ratingDelta(1000, 0)).toBeLessThan(0);
    expect(ratingDelta(0, 30)).toBe(0);
  });
});

describe('placements', () => {
  it('hides rating for five matches, then places at the average’s equilibrium', () => {
    const h = replayMatches(matches([60, 60, 60, 60, 60]));
    expect(h.outcomes.slice(0, 4).every((o) => o.result === 'placement' && o.change === null)).toBe(true);
    expect(h.outcomes[4].change).toBe('placed');
    expect(h.state.placed).toBe(true);
    expect(h.state.rating).toBe(1750);
    expect(rankFromRating(h.state.rating).label).toBe('Platinum 3');
  });

  it('caps placement at Platinum 1', () => {
    expect(replayMatches(matches([100, 100, 100, 100, 100])).state.rating).toBe(PLACEMENT_CAP);
  });

  it('counts missed placement days as zero', () => {
    expect(replayMatches(matches([100, 0, 100, 0, 100])).state.rating).toBe(Math.round(equilibriumRating(60)));
  });

  it('gives no preview until placed', () => {
    expect(previewMatch(INITIAL_STATE, 100)).toBeNull();
    expect(previewMatch(placed(1000), 100)?.delta).toBe(ratingDelta(1000, 100));
  });
});

describe('promotion, demotion and shield', () => {
  it('flags promotion across a division boundary', () => {
    const r = applyMatch(placed(1290), { date: start, score: 100, goals: [] }, []);
    expect(r.outcome).toMatchObject({ result: 'victory', change: 'promoted' });
  });

  it('shields a new tier for three matches, then allows demotion', () => {
    let s = applyMatch(placed(1490), { date: start, score: 100, goals: [] }, []).state;
    expect(rankFromRating(s.rating).tier.id).toBe('platinum');
    expect(s.shield).toBe(3);
    for (let i = 0; i < 3; i++) {
      const r = applyMatch(s, { date: start, score: 0, goals: [] }, []);
      expect(r.state.rating).toBe(1500);
      if (i === 0) expect(r.outcome.shielded).toBe(true);
      s = r.state;
    }
    const r = applyMatch(s, { date: start, score: 0, goals: [] }, []);
    expect(r.state.rating).toBeLessThan(1500);
    expect(r.outcome.change).toBe('demoted');
  });

  it('never goes below zero', () => {
    expect(applyMatch(placed(10), { date: start, score: 0, goals: [] }, []).state.rating).toBe(0);
  });

  it('tracks wins, losses and runs', () => {
    const h = replayMatches(matches([60, 60, 60, 60, 60, 100, 100, 0]));
    expect(h.state).toMatchObject({ wins: 2, losses: 1, run: -1 });
  });
});

describe('replay', () => {
  it('is order-independent and deterministic', () => {
    const m = simulate(40, () => [0.7, 0.7, 0.7, 0.7, 0.5, 0.5]);
    expect(replayMatches([...m].reverse()).state).toEqual(replayMatches(m).state);
  });
});

describe('locking', () => {
  it('locks a day at the end of the following day', () => {
    expect(datesToLock('2026-11-10', null, '2026-11-12')).toEqual(['2026-11-10']);
    expect(datesToLock('2026-11-10', null, '2026-11-11')).toEqual([]);
    expect(datesToLock('2026-11-10', '2026-11-10', '2026-11-14')).toEqual(['2026-11-11', '2026-11-12']);
    expect(datesToLock('2026-11-10', '2026-11-12', '2026-11-14')).toEqual([]);
  });

  it('fills a long absence with every missed day', () => {
    expect(datesToLock('2026-11-01', '2026-11-01', '2026-11-30')).toHaveLength(27);
  });
});

/**
 * Balance simulations (seeded). These pin the feel of the ladder:
 * rank should reflect real consistency and the top must be earned.
 */
describe('balance', () => {
  it('a perfect player reaches Diamond in a week and Zenith in about 2½ months, not sooner', () => {
    const m = simulate(120, () => [1, 1, 1, 1, 1, 1]);
    expect(labelAfter(m, 7)).toMatch(/^Diamond/);
    expect(labelAfter(m, 60)).not.toBe('Zenith');
    expect(labelAfter(m, 90)).toBe('Zenith');
  });

  it('a consistent player (~75 a day) climbs to Diamond in 2–3 months', () => {
    const m = simulate(180, () => [0.75, 0.8, 0.85, 0.8, 0.6, 0.5]);
    expect(labelAfter(m, 30)).toMatch(/^Platinum/);
    expect(labelAfter(m, 90)).toMatch(/^Diamond/);
    expect(labelAfter(m, 180)).toMatch(/^Master/);
  });

  it('a casual player who skips weekends stays in Bronze/Silver', () => {
    const m = simulate(180, (i) => (i % 7 >= 5 ? null : [0.5, 0.5, 0.6, 0.6, 0.3, 0.3]));
    const label = labelAfter(m, 180);
    expect(label).toMatch(/^(Bronze|Silver)/);
  });

  it('two weeks away costs a tier, which is won back', () => {
    const p = [0.75, 0.8, 0.85, 0.8, 0.6, 0.5];
    const m = simulate(180, (i) => (i >= 30 && i < 44 ? null : p));
    const before = replayMatches(m.slice(0, 30)).state.rating;
    const after = replayMatches(m.slice(0, 44)).state.rating;
    expect(before - after).toBeGreaterThan(300);
    expect(labelAfter(m, 180)).toMatch(/^Master/);
  });

  it('cannot be farmed with water alone', () => {
    const m = simulate(90, () => [0, 0, 0, 1, 0, 0]);
    expect(replayMatches(m).state.rating).toBe(0);
  });
});
