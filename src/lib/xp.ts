/**
 * Level curve. Going from level n to n+1 costs 100 + 50·(n−1) XP, so early
 * levels come quickly and later ones take steady, consistent play:
 *   L1→2: 100   L2→3: 150   L3→4: 200 …   L10→11: 550
 * Total XP to REACH level n: 25·(n−1)·(n+2).
 */
export function xpForLevelUp(level: number): number {
  return 100 + 50 * (level - 1);
}

export function totalXpToReach(level: number): number {
  return 25 * (level - 1) * (level + 2);
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP needed to complete the current level. */
  needed: number;
  /** XP still required for the next level. */
  remaining: number;
  ratio: number;
  totalXp: number;
}

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  // Solve 25(n−1)(n+2) <= xp for n, then correct for float error.
  // With m = n − 1: 25·m·(m + 3) <= xp  →  m = (−3 + √(9 + 4·xp/25)) / 2
  let level = Math.max(1, Math.floor((-3 + Math.sqrt(9 + (4 * xp) / 25)) / 2) + 1);
  while (totalXpToReach(level + 1) <= xp) level++;
  while (level > 1 && totalXpToReach(level) > xp) level--;
  const intoLevel = xp - totalXpToReach(level);
  const needed = xpForLevelUp(level);
  return { level, intoLevel, needed, remaining: needed - intoLevel, ratio: intoLevel / needed, totalXp: xp };
}

/** Original rank titles that unlock as you level. */
const RANKS: { level: number; title: string }[] = [
  { level: 1, title: 'Initiate' },
  { level: 3, title: 'Wayfarer' },
  { level: 5, title: 'Vanguard' },
  { level: 8, title: 'Sentinel' },
  { level: 12, title: 'Warden' },
  { level: 16, title: 'Champion' },
  { level: 20, title: 'Paragon' },
  { level: 25, title: 'Ascendant' },
  { level: 30, title: 'Mythic' },
  { level: 40, title: 'Eternal' },
];

export function rankTitle(level: number): string {
  let title = RANKS[0].title;
  for (const r of RANKS) if (level >= r.level) title = r.title;
  return title;
}

export function nextRank(level: number): { level: number; title: string } | null {
  return RANKS.find((r) => r.level > level) ?? null;
}
