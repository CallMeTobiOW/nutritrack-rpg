/**
 * Persistent data model. These interfaces describe exactly what is stored in
 * IndexedDB (see src/db/db.ts). All weights are kg, volumes ml, amounts g/ml.
 */
import type { DateKey } from './dates';
import type { ScoredGoal } from './rank';
import type { NutrientKey, NutrientValues } from './nutrients';
import type { MeasureUnit } from './nutrition';
import type { ActivityLevel, Objective, Targets } from './targets';
import type { Sex } from './references';
import type { WeightUnit } from './units';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
export const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export interface Serving {
  label: string; // e.g. "1 bar", "1 cup"
  amount: number; // g or ml
}

export type FoodSource = 'off' | 'custom';

export type NutriScore = 'a' | 'b' | 'c' | 'd' | 'e';

/** Extra facts Open Food Facts gives about a product, shown as badges and warnings. */
export interface FoodQuality {
  nutriScore?: NutriScore;
  /** NOVA processing group: 1 unprocessed … 4 ultra-processed. */
  nova?: 1 | 2 | 3 | 4;
  /** Open Food Facts marks the nutrition facts as still to be completed. */
  incomplete?: boolean;
  /** Alcohol in % vol. Alcohol carries calories the macros don't, so the calorie check skips it. */
  alcohol?: number;
  /** Additive E-numbers, e.g. ["e102", "e330"]. Undefined = ingredients not known. */
  additives?: string[];
  /** Estimated % of fruit, vegetables, pulses and nuts. */
  fruitVeg?: number;
  /** Open Food Facts category tags, most specific last (used to find better alternatives). */
  categories?: string[];
  /** Version of this record's format; older records are refreshed when scanned. */
  v?: number;
  /** The ingredients list, and where it came from. */
  ingredients?: string;
  ingredientsFrom?: 'off' | 'photo' | 'typed';
  /** True when NOVA was worked out by this app from the ingredients, not given by Open Food Facts. */
  novaEstimated?: boolean;
  /** Ingredients that mark ultra-processing, e.g. ["flavouring", "glucose syrup"]. */
  markers?: string[];
}

/** A food the player has saved, scanned or created. */
export interface Food {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  source: FoodSource;
  unit: MeasureUnit;
  /** Per 100 g / 100 ml. Missing keys = unknown. */
  per100: NutrientValues;
  servings: Serving[];
  favorite: boolean;
  /** True when the product was added through the barcode scanner. */
  scanned?: boolean;
  /** When this product was last scanned (drives "Recent scans"). */
  lastScannedAt?: number;
  /** When the Open Food Facts data was last downloaded. */
  fetchedAt?: number;
  /** The player corrected this product's values; refreshes must not overwrite them. */
  edited?: boolean;
  quality?: FoodQuality;
  /** The portion last logged, offered first next time (quick re-log). */
  lastAmount?: number;
  lastServingLabel?: string;
  /** Recently used foods are those with lastUsedAt set. */
  lastUsedAt?: number;
  useCount: number;
  createdAt: number;
  updatedAt: number;
}

/** A snapshot of a food stored on each diary entry so history never changes. */
export interface FoodSnapshot {
  name: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  unit: MeasureUnit;
  per100: NutrientValues;
  servings: Serving[];
}

export interface DiaryEntry {
  id: string;
  date: DateKey;
  meal: MealSlot;
  foodId?: string;
  food: FoodSnapshot;
  /** Amount eaten in g or ml. */
  amount: number;
  /** Label of the serving the player picked, for display only. */
  servingLabel?: string;
  createdAt: number;
}

export interface SavedMealItem {
  foodId?: string;
  food: FoodSnapshot;
  amount: number;
  servingLabel?: string;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
  createdAt: number;
  lastUsedAt?: number;
}

export interface PendingScan {
  code: string;
  at: number;
  /** offline: will be looked up when back online. notfound: not in any database yet. */
  status: 'offline' | 'notfound';
}

export interface WaterEntry {
  id: string;
  date: DateKey;
  ml: number;
  createdAt: number;
}

export interface WeightEntry {
  id: string;
  date: DateKey;
  kg: number;
  note?: string;
  createdAt: number;
}

export type QuestCategory = 'daily' | 'side' | 'weekly' | 'bonus';
export type QuestRecurrence = 'daily' | 'weekly' | 'once';
/** Quests that complete themselves from tracked data. */
export type AutoRule = 'water' | 'protein' | 'logMeals' | 'calorieRange' | 'weighIn' | 'fiber';

export interface Quest {
  id: string;
  title: string;
  description?: string;
  category: QuestCategory;
  recurrence: QuestRecurrence;
  xp: number;
  auto?: AutoRule;
  icon: string;
  order: number;
  createdAt: number;
}

export type XpEventKind = 'quest' | 'bonus' | 'achievement';

/**
 * The XP ledger. The `id` is deterministic (e.g. `quest:<id>:<period>`), so
 * re-ticking a quest can never pay out twice: the same row is written again.
 * Unticking removes the row and its XP.
 */
export interface XpEvent {
  id: string;
  kind: XpEventKind;
  refId: string;
  /** Day key, week key or 'once'. */
  period: string;
  date: DateKey;
  xp: number;
  title: string;
  /** Snapshot of the quest category, for history and stats. */
  category?: QuestCategory;
  createdAt: number;
}

export interface AchievementUnlock {
  id: string;
  unlockedAt: number;
  date: DateKey;
}

export interface BriefingRecord {
  date: DateKey;
  messageId: string;
  /** Extra messages requested that day via "Another briefing". */
  extra: string[];
  /** The message currently on screen (main or one of the extras). */
  currentId: string;
  /** Set once the player taps "Begin mission"; until then the briefing opens on launch. */
  acknowledged: boolean;
  shownAt: number;
}

export interface Profile {
  id: 'me';
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  /** Starting/current weight from the profile form; the weight log takes over once used. */
  weightKg: number;
  goalWeightKg?: number;
  activity: ActivityLevel;
  objective: Objective;
  targets: Targets;
  microTargets: Partial<Record<NutrientKey, number>>;
  /** True when the player has edited targets by hand. */
  customTargets: boolean;
  /** True when the player set their own water goal; kept when other targets are recalculated. */
  customWater?: boolean;
  onboarded: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ThemePreference = 'dark' | 'light' | 'system';

export interface Settings {
  id: 'settings';
  theme: ThemePreference;
  weightUnit: WeightUnit;
  sound: boolean;
  allDailyBonusXp: number;
  waterQuickAmounts: number[];
  /** Ids of briefings shown in the current cycle, to avoid repeats. */
  seenBriefings: string[];
  lastBackupAt?: number;
  /** Barcodes scanned that still need attention: looked up later (offline) or added by hand (not found). */
  pendingScans?: PendingScan[];
  /** Highest level reached, so a level-up is celebrated only the first time. */
  highestLevel?: number;
  /** First day of competitive rank matches (set the first time the app syncs with rank support). */
  rankSeasonStart?: DateKey;
  /**
   * The ladder step the player last saw celebrated (-1 while in placements),
   * so a rank change is shown once, even when it happens while the app is closed.
   */
  rankSeenStep?: number;
}

/** A locked competitive-rank match: one calendar day's result. Never edited once written. */
export interface RankMatchRecord {
  date: DateKey;
  /** 0–100. */
  score: number;
  /** Goals hit that day (keys of GoalFlags). */
  goals: ScoredGoal[];
  lockedAt: number;
}
