import { describe, expect, it } from 'vitest';
import { BRIEFINGS } from '../../data/briefings';
import { pickBriefing } from '../briefing';

describe('briefings', () => {
  it('has at least 100 unique, non-empty messages across four voices', () => {
    expect(BRIEFINGS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(BRIEFINGS.map((b) => b.id)).size).toBe(BRIEFINGS.length);
    expect(new Set(BRIEFINGS.map((b) => b.text)).size).toBe(BRIEFINGS.length);
    expect(new Set(BRIEFINGS.map((b) => b.category))).toEqual(new Set(['fantasy', 'commander', 'warrior', 'mentor']));
    for (const b of BRIEFINGS) expect(b.text.length).toBeGreaterThan(40);
  });

  it('does not repeat a message until every message has been seen', () => {
    let seen: string[] = [];
    const shown = new Set<string>();
    for (let i = 0; i < BRIEFINGS.length; i++) {
      const r = pickBriefing(seen);
      expect(shown.has(r.briefing.id)).toBe(false);
      shown.add(r.briefing.id);
      seen = r.seen;
    }
    expect(shown.size).toBe(BRIEFINGS.length);
    const next = pickBriefing(seen);
    expect(next.seen).toEqual([next.briefing.id]); // a new cycle starts
    expect(next.briefing.id).not.toBe(seen[seen.length - 1]); // never back-to-back
  });

  it('respects exclusions', () => {
    const pool = BRIEFINGS.slice(0, 3);
    const r = pickBriefing([], [pool[0].id, pool[1].id], () => 0, pool);
    expect(r.briefing.id).toBe(pool[2].id);
  });
});
