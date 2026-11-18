import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, newlyUnlocked, type PlayerStats } from '../achievements';

const zero: PlayerStats = {
  questsCompleted: 0,
  dailyMissionsCompleted: 0,
  fullClearDays: 0,
  weeklyClears: 0,
  bestStreak: 0,
  waterGoalDays: 0,
  proteinGoalDays: 0,
  macroGoalDays: 0,
  daysLogged: 0,
  foodsLogged: 0,
  weighIns: 0,
  scannedFoods: 0,
  level: 1,
};

describe('achievements', () => {
  it('have unique ids and positive XP', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.every((a) => a.xp > 0)).toBe(true);
  });

  it('unlocks nothing for a new player', () => {
    expect(newlyUnlocked(zero, new Set())).toEqual([]);
  });

  it('unlocks the right badges at thresholds', () => {
    const ids = (s: Partial<PlayerStats>) => newlyUnlocked({ ...zero, ...s }, new Set()).map((a) => a.id);
    expect(ids({ questsCompleted: 1 })).toEqual(['first-victory']);
    expect(ids({ dailyMissionsCompleted: 5 })).toContain('disciplined');
    expect(ids({ dailyMissionsCompleted: 4 })).not.toContain('disciplined');
    expect(ids({ bestStreak: 7 })).toEqual(expect.arrayContaining(['kindling', 'consistency']));
    expect(ids({ waterGoalDays: 7 })).toEqual(expect.arrayContaining(['wellspring', 'hydration-hero']));
    expect(ids({ dailyMissionsCompleted: 30 })).toContain('the-grind');
  });

  it('does not unlock twice', () => {
    expect(newlyUnlocked({ ...zero, questsCompleted: 3 }, new Set(['first-victory']))).toEqual([]);
  });
});
