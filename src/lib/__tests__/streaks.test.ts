import { describe, expect, it } from 'vitest';
import { computeStreak } from '../streaks';

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-11-15', '2026-11-16', '2026-11-17'], '2026-11-17')).toEqual({ current: 3, best: 3, activeToday: true });
  });

  it('does not break the streak before today is active', () => {
    expect(computeStreak(['2026-11-15', '2026-11-16'], '2026-11-17')).toMatchObject({ current: 2, activeToday: false });
  });

  it('resets after a missed day but remembers the best run', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-10', '2026-11-11'];
    expect(computeStreak(days, '2026-11-12')).toEqual({ current: 2, best: 4, activeToday: false });
    expect(computeStreak(days, '2026-11-14')).toMatchObject({ current: 0, best: 4 });
  });

  it('handles month boundaries and duplicates', () => {
    expect(computeStreak(['2026-10-31', '2026-11-01', '2026-11-01'], '2026-11-01').current).toBe(2);
  });

  it('is zero with no data', () => {
    expect(computeStreak([], '2026-11-17')).toEqual({ current: 0, best: 0, activeToday: false });
  });
});
