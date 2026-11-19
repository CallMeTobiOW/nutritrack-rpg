import { describe, expect, it } from 'vitest';
import { addDays } from '../dates';
import {
  BADGES,
  BADGE_IDS,
  INITIAL_BADGE,
  MAX_STEP,
  applyBadgeDay,
  badgeById,
  badgeChanges,
  badgeEventId,
  buildBadgeView,
  dayLogged,
  earnedSteps,
  replayBadge,
  seenBadgeStep,
  stepLabel,
  stepOf,
  stepXp,
  winsToNextStep,
  xpThroughStep,
  type BadgeId,
  type BadgeState,
} from '../badges';
import { rankFromRating, type RankMatch } from '../rank';

const start = '2026-01-01';
const ironWill = badgeById('iron-will')!;

/** Days where the protein goal is hit or missed (everything else logged normally). */
function days(hits: boolean[], from = start): RankMatch[] {
  return hits.map((h, i) => ({ date: addDays(from, i), score: h ? 50 : 30, goals: h ? ['protein', 'logMeals'] : ['logMeals'], entries: 4 }));
}
const replay = (hits: boolean[]) => replayBadge(ironWill, days(hits));
const run = (n: number, v = true) => Array.from({ length: n }, () => v);

/** Deterministic pseudo-random hits at a fixed rate. */
function player(rate: number, n: number, seed = 11): boolean[] {
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  return Array.from({ length: n }, () => rand() < rate);
}
const label = (s: BadgeState) => rankFromRating(s.rating).label;
const tierOf = (s: BadgeState) => rankFromRating(s.rating).tier.name;

describe('badge set', () => {
  it('has nine distinct badges with goals and icons', () => {
    expect(BADGES).toHaveLength(9);
    expect(new Set(BADGE_IDS).size).toBe(9);
    for (const b of BADGES) expect(b.goal && b.icon && b.title && b.lore).toBeTruthy();
  });

  it('reads each goal from the locked day', () => {
    const m: RankMatch = { date: start, score: 100, goals: ['protein', 'water', 'fiber', 'calorieRange', 'macros', 'logMeals'], entries: 5 };
    for (const b of BADGES) expect(b.hit(m), b.id).toBe(true);
    const seventy: RankMatch = { date: start, score: 70, goals: ['calorieRange', 'protein', 'logMeals'], entries: 3 };
    expect(badgeById('iron-discipline')!.hit(seventy)).toBe(true);
    expect(badgeById('flawless')!.hit(seventy)).toBe(false);
    expect(badgeById('wellspring')!.hit(seventy)).toBe(false);
  });

  it('a day with nothing logged is a loss for every badge', () => {
    const empty: RankMatch = { date: start, score: 0, goals: [], entries: 0 };
    for (const b of BADGES) expect(b.hit(empty), b.id).toBe(false);
  });

  it('records locked before entries were stored count as logged when any goal was hit', () => {
    expect(dayLogged({ date: start, score: 15, goals: ['water'] })).toBe(true);
    expect(dayLogged({ date: start, score: 0, goals: [] })).toBe(false);
    expect(dayLogged({ date: start, score: 0, goals: [], entries: 2 })).toBe(true);
  });
});

describe('ladder steps', () => {
  it('maps steps to the rank ladder', () => {
    expect(stepLabel(0)).toBe('Bronze 5');
    expect(stepLabel(4)).toBe('Bronze 1');
    expect(stepLabel(5)).toBe('Silver 5');
    expect(stepLabel(34)).toBe('Grandmaster 1');
    expect(stepLabel(MAX_STEP)).toBe('Zenith');
    expect(stepOf(0)).toBe(0);
    expect(stepOf(1234)).toBe(12);
    expect(stepOf(9999)).toBe(MAX_STEP);
  });
});

describe('climbing', () => {
  it('starts unclaimed and is claimed by the first win, at Bronze 5', () => {
    expect(seenBadgeStep(INITIAL_BADGE)).toBe(-1);
    const s = replay([false, false, true]);
    expect(s.hits).toBe(1);
    expect(label(s)).toBe('Bronze 5');
    expect(seenBadgeStep(s)).toBe(0);
  });

  it('a win gains and a loss costs, more so the higher you are', () => {
    const low = applyBadgeDay({ ...INITIAL_BADGE, rating: 200, peak: 200 }, true);
    const high = applyBadgeDay({ ...INITIAL_BADGE, rating: 3000, peak: 3000 }, true);
    expect(low.rating - 200).toBeGreaterThan(high.rating - 3000);
    const lowLoss = applyBadgeDay({ ...INITIAL_BADGE, rating: 600, peak: 600 }, false);
    const highLoss = applyBadgeDay({ ...INITIAL_BADGE, rating: 3000, peak: 3000 }, false);
    expect(600 - lowLoss.rating).toBeLessThan(3000 - highLoss.rating);
  });

  it('each new tier takes longer to reach than the last on a perfect run', () => {
    const firstDay: number[] = [];
    let s = INITIAL_BADGE;
    for (let d = 1; d <= 400 && firstDay.length < 7; d++) {
      s = applyBadgeDay(s, true);
      while (rankFromRating(s.rating).tierIndex > firstDay.length) firstDay.push(d);
    }
    const gaps = firstDay.map((d, i) => d - (firstDay[i - 1] ?? 0));
    for (let i = 1; i < gaps.length; i++) expect(gaps[i], `tier ${i + 1}`).toBeGreaterThanOrEqual(gaps[i - 1]);
    // Pacing: Silver in about a week, Gold in about two weeks, Zenith in about four months.
    expect(firstDay[0]).toBeGreaterThanOrEqual(6);
    expect(firstDay[0]).toBeLessThanOrEqual(9);
    expect(firstDay[1]).toBeGreaterThanOrEqual(14);
    expect(firstDay[1]).toBeLessThanOrEqual(19);
    expect(firstDay[6]).toBeGreaterThanOrEqual(100);
    expect(firstDay[6]).toBeLessThanOrEqual(130);
  });

  it('wins needed for the next division grow up the ladder', () => {
    expect(winsToNextStep(0)).toBe(2);
    expect(winsToNextStep(3400)).toBeGreaterThan(winsToNextStep(1000));
    expect(winsToNextStep(3600)).toBe(0);
  });

  it('settles where the hit rate matches the tier, like the rank', () => {
    const settle = (rate: number) => {
      const hits = player(rate, 600);
      // Average rating over the last 200 days, after it has settled.
      let s = INITIAL_BADGE;
      let sum = 0;
      hits.forEach((h, i) => {
        s = applyBadgeDay(s, h);
        if (i >= 400) sum += s.rating;
      });
      return rankFromRating(sum / 200).tier.name;
    };
    expect(settle(0.2)).toBe('Bronze');
    expect(['Silver', 'Gold']).toContain(settle(0.45));
    expect(['Gold', 'Platinum']).toContain(settle(0.55));
    expect(['Diamond', 'Master']).toContain(settle(0.7));
    expect(['Grandmaster', 'Zenith']).toContain(settle(0.88));
    expect(settle(0.97)).toBe('Zenith');
  });

  it('drops when the goal slips, but keeps the lifetime peak', () => {
    const s = replay([...run(40), ...run(20, false)]);
    expect(rankFromRating(s.peak).tier.name).toBe('Diamond');
    expect(s.rating).toBeLessThan(s.peak);
    expect(tierOf(s)).not.toBe('Diamond');
    expect(s.bestRun).toBe(40);
    expect(s.run).toBe(0);
  });

  it('a promotion shield stops an immediate fall out of a new tier', () => {
    let s = INITIAL_BADGE;
    while (rankFromRating(s.rating).tierIndex < 1) s = applyBadgeDay(s, true);
    expect(s.shield).toBe(3);
    const after = applyBadgeDay(applyBadgeDay(s, false), false);
    expect(tierOf(after)).toBe('Silver');
  });

  it('never goes below zero', () => {
    expect(replay(run(30, false)).rating).toBe(0);
  });

  it('replays in date order whatever order the days come in', () => {
    const d = days([true, true, false, true, true, true, false, true]);
    expect(replayBadge(ironWill, [...d].reverse())).toEqual(replayBadge(ironWill, d));
  });
});

describe('XP', () => {
  it('pays more for higher tiers, 100 for Zenith, nothing for the starting step', () => {
    expect(stepXp(0)).toBe(0);
    expect(stepXp(1)).toBe(5);
    expect(stepXp(5)).toBe(10);
    expect(stepXp(34)).toBe(35);
    expect(stepXp(MAX_STEP)).toBe(100);
    expect(xpThroughStep(MAX_STEP)).toBe(4 * 5 + 5 * (10 + 15 + 20 + 25 + 30 + 35) + 100);
  });

  it('owes each step up to the peak once, even after slipping and climbing back', () => {
    const s = replay([...run(30), ...run(15, false), ...run(30)]);
    const steps = earnedSteps(s);
    expect(steps).toEqual(Array.from({ length: stepOf(s.peak) }, (_, i) => i + 1));
    expect(new Set(steps.map((x) => badgeEventId('iron-will', x))).size).toBe(steps.length);
    expect(earnedSteps(INITIAL_BADGE)).toEqual([]);
  });
});

describe('view and changes', () => {
  it('projects unlocked days on top of the locked standing', () => {
    const locked = days(run(10));
    const pending = days([true, true], addDays(start, 10));
    const today = addDays(start, 11);
    const v = buildBadgeView(locked, pending, today).find((b) => b.def.id === 'iron-will')!;
    expect(v.locked.days).toBe(10);
    expect(v.projected.days).toBe(12);
    expect(v.projected.rating).toBeGreaterThan(v.locked.rating);
    expect(v.hitToday).toBe(true);
    expect(v.claimed).toBe(true);
    const water = buildBadgeView(locked, pending, today).find((b) => b.def.id === 'wellspring')!;
    expect(water.claimed).toBe(false);
  });

  it('classifies claimed, division, tier and drop changes', () => {
    const at = (rating: number, hits = 1): BadgeState => ({ ...INITIAL_BADGE, rating, peak: rating, hits });
    const states = Object.fromEntries(BADGE_IDS.map((id) => [id, INITIAL_BADGE])) as Record<BadgeId, BadgeState>;
    states['iron-will'] = at(50);
    states.wellspring = at(320);
    states['deep-roots'] = at(520);
    states['true-aim'] = at(150);
    const changes = badgeChanges(states, { wellspring: 1, 'deep-roots': 4, 'true-aim': 6 });
    expect(changes).toEqual([
      { id: 'iron-will', from: -1, to: 0, kind: 'claimed' },
      { id: 'wellspring', from: 1, to: 3, kind: 'division' },
      { id: 'deep-roots', from: 4, to: 5, kind: 'tier' },
      { id: 'true-aim', from: 6, to: 1, kind: 'drop' },
    ]);
    expect(badgeChanges(states, { 'iron-will': 0, wellspring: 3, 'deep-roots': 5, 'true-aim': 1 })).toEqual([]);
  });
});
