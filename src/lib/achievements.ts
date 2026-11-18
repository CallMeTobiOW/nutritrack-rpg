/**
 * Achievements: permanent unlocks evaluated from a snapshot of lifetime
 * stats. Once unlocked they stay unlocked, and their XP is paid once via a
 * deterministic ledger id. None of them reward restriction, skipped meals or
 * excessive exercise: every food-related badge is about logging honestly or
 * landing inside a healthy range.
 */

export interface PlayerStats {
  questsCompleted: number;
  dailyMissionsCompleted: number;
  fullClearDays: number;
  weeklyClears: number;
  bestStreak: number;
  waterGoalDays: number;
  proteinGoalDays: number;
  macroGoalDays: number;
  daysLogged: number;
  foodsLogged: number;
  weighIns: number;
  scannedFoods: number;
  level: number;
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'mythic';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name, see components/ui/Icon.tsx
  tier: AchievementTier;
  xp: number;
  /** Progress towards the goal: [current, goal]. */
  progress: (s: PlayerStats) => [number, number];
}

const p = (field: keyof PlayerStats, goal: number) => (s: PlayerStats): [number, number] => [Math.min(s[field], goal), goal];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-victory', title: 'First Victory', description: 'Complete your first quest.', icon: 'swords', tier: 'bronze', xp: 25, progress: p('questsCompleted', 1) },
  { id: 'supply-run', title: 'Supply Run', description: 'Log your first food.', icon: 'utensils', tier: 'bronze', xp: 15, progress: p('foodsLogged', 1) },
  { id: 'field-scanner', title: 'Field Scanner', description: 'Add a product by scanning its barcode.', icon: 'scan-barcode', tier: 'bronze', xp: 15, progress: p('scannedFoods', 1) },
  { id: 'baseline', title: 'Baseline Established', description: 'Log your first weigh-in.', icon: 'scale', tier: 'bronze', xp: 15, progress: p('weighIns', 1) },
  { id: 'wellspring', title: 'Wellspring', description: 'Reach your water goal for the first time.', icon: 'droplet', tier: 'bronze', xp: 15, progress: p('waterGoalDays', 1) },
  { id: 'disciplined', title: 'Disciplined', description: 'Complete five daily missions.', icon: 'shield-check', tier: 'bronze', xp: 30, progress: p('dailyMissionsCompleted', 5) },
  { id: 'full-clear', title: 'Full Clear', description: 'Complete every daily mission in a single day.', icon: 'crown', tier: 'silver', xp: 40, progress: p('fullClearDays', 1) },
  { id: 'kindling', title: 'Kindling', description: 'Keep a three-day streak.', icon: 'flame', tier: 'bronze', xp: 25, progress: p('bestStreak', 3) },
  { id: 'consistency', title: 'Consistency', description: 'Maintain a seven-day streak.', icon: 'calendar-check', tier: 'silver', xp: 60, progress: p('bestStreak', 7) },
  { id: 'balanced-plate', title: 'Balanced Plate', description: 'Hit your protein, carb and fat goals in one day.', icon: 'target', tier: 'silver', xp: 40, progress: p('macroGoalDays', 1) },
  { id: 'nutrition-master', title: 'Nutrition Master', description: 'Hit your macro goals on ten days.', icon: 'gem', tier: 'gold', xp: 120, progress: p('macroGoalDays', 10) },
  { id: 'iron-will', title: 'Iron Will', description: 'Reach your protein target on ten days.', icon: 'dumbbell', tier: 'silver', xp: 60, progress: p('proteinGoalDays', 10) },
  { id: 'hydration-hero', title: 'Hydration Hero', description: 'Reach your water goal seven times.', icon: 'waves', tier: 'silver', xp: 60, progress: p('waterGoalDays', 7) },
  { id: 'quartermaster', title: 'Quartermaster', description: 'Log food on seven different days.', icon: 'notebook-pen', tier: 'silver', xp: 50, progress: p('daysLogged', 7) },
  { id: 'week-conqueror', title: 'Week Conqueror', description: 'Clear every weekly objective in one week.', icon: 'flag', tier: 'silver', xp: 60, progress: p('weeklyClears', 1) },
  { id: 'steady-measure', title: 'Steady Measure', description: 'Log ten weigh-ins.', icon: 'line-chart', tier: 'silver', xp: 40, progress: p('weighIns', 10) },
  { id: 'unbroken', title: 'Unbroken', description: 'Maintain a fourteen-day streak.', icon: 'zap', tier: 'gold', xp: 120, progress: p('bestStreak', 14) },
  { id: 'the-grind', title: 'The Grind Never Stops', description: 'Complete 30 daily missions.', icon: 'mountain', tier: 'gold', xp: 100, progress: p('dailyMissionsCompleted', 30) },
  { id: 'vanguard', title: 'Vanguard', description: 'Reach level 5.', icon: 'star', tier: 'silver', xp: 50, progress: p('level', 5) },
  { id: 'chronicler', title: 'Chronicler', description: 'Log food on thirty different days.', icon: 'book-open', tier: 'gold', xp: 150, progress: p('daysLogged', 30) },
  { id: 'centurion', title: 'Centurion', description: 'Complete 100 quests.', icon: 'medal', tier: 'gold', xp: 150, progress: p('questsCompleted', 100) },
  { id: 'paragon', title: 'Paragon', description: 'Reach level 20.', icon: 'sparkles', tier: 'mythic', xp: 200, progress: p('level', 20) },
  { id: 'legend', title: 'Legend in the Making', description: 'Maintain a thirty-day streak.', icon: 'trophy', tier: 'mythic', xp: 300, progress: p('bestStreak', 30) },
];

export function isUnlocked(def: AchievementDef, s: PlayerStats): boolean {
  const [cur, goal] = def.progress(s);
  return cur >= goal;
}

/** Achievements that are earned by `stats` but not yet in `unlocked`. */
export function newlyUnlocked(stats: PlayerStats, unlocked: Set<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && isUnlocked(a, stats));
}

export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: '#d08a4f',
  silver: '#b9c7d8',
  gold: '#f5c046',
  mythic: '#b98cff',
};
