import { describe, expect, it } from 'vitest';
import { addDays, dateRange, diffDays, lastNDays, startOfWeek, toDateKey, toWeekKey } from '../dates';

describe('dates', () => {
  it('formats local dates without UTC shifting', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is safe across daylight-saving changes', () => {
    // UK clocks change on 29 Mar 2026 and 25 Oct 2026
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('steps past a calendar day that a time zone skipped', () => {
    // Samoa skipped 30 Dec 2011; stepping back must not stall on that day.
    expect(addDays('2011-12-30', -1)).toBe('2011-12-29');
    expect(addDays('2011-12-31', -1)).toBe('2011-12-30');
  });

  it('builds inclusive ranges', () => {
    expect(dateRange('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
    expect(lastNDays('2026-11-17', 3)).toEqual(['2026-11-15', '2026-11-16', '2026-11-17']);
  });

  it('computes ISO week keys (Monday start)', () => {
    expect(toWeekKey('2026-11-16')).toBe('2026-W47'); // Monday
    expect(toWeekKey('2026-11-22')).toBe('2026-W47'); // Sunday
    expect(toWeekKey('2026-11-23')).toBe('2026-W48');
    expect(toWeekKey('2027-01-01')).toBe('2026-W53'); // Friday belongs to 2026's last week
    expect(toWeekKey('2024-12-30')).toBe('2025-W01');
    expect(toWeekKey('2021-01-03')).toBe('2020-W53');
  });

  it('finds the Monday of a week', () => {
    expect(startOfWeek('2026-11-17')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16');
  });
});
