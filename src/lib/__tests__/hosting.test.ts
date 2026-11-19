import { describe, expect, it } from 'vitest';
import { isLegacyHost, NEW_HOME_LABEL, NEW_HOME_URL } from '../hosting';

describe('hosting', () => {
  it('recognises only the old GitHub Pages address as legacy', () => {
    expect(isLegacyHost('callmetobiow.github.io')).toBe(true);
    expect(isLegacyHost('nutritrack-rpg.vercel.app')).toBe(false);
    expect(isLegacyHost('localhost')).toBe(false);
    expect(isLegacyHost('github.io.example.com')).toBe(false);
  });

  it('points to an https root address', () => {
    expect(NEW_HOME_URL).toMatch(/^https:\/\/[a-z0-9-]+\.vercel\.app\/$/);
    expect(NEW_HOME_LABEL).not.toMatch(/https|\/$/);
  });
});
