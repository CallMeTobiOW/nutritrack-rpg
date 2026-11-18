import { describe, expect, it } from 'vitest';
import { levelFromXp, rankTitle, totalXpToReach, xpForLevelUp } from '../xp';

describe('level curve', () => {
  it('has consistent totals', () => {
    let sum = 0;
    for (let lvl = 1; lvl < 60; lvl++) {
      expect(totalXpToReach(lvl)).toBe(sum);
      sum += xpForLevelUp(lvl);
    }
  });

  it('maps XP to the right level at every boundary', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, intoLevel: 0, needed: 100, remaining: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toMatchObject({ level: 2, intoLevel: 0, needed: 150 });
    expect(levelFromXp(249).level).toBe(2);
    expect(levelFromXp(250).level).toBe(3);
    for (let lvl = 1; lvl < 80; lvl++) {
      expect(levelFromXp(totalXpToReach(lvl)).level).toBe(lvl);
      expect(levelFromXp(totalXpToReach(lvl + 1) - 1).level).toBe(lvl);
    }
  });

  it('handles negative and fractional XP', () => {
    expect(levelFromXp(-50).level).toBe(1);
    expect(levelFromXp(100.9).level).toBe(2);
  });

  it('gives rank titles', () => {
    expect(rankTitle(1)).toBe('Initiate');
    expect(rankTitle(5)).toBe('Vanguard');
    expect(rankTitle(7)).toBe('Vanguard');
    expect(rankTitle(99)).toBe('Eternal');
  });
});
