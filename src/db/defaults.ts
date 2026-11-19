import type { Profile, Quest, QuestCategory, QuestRecurrence, AutoRule, Settings } from '../lib/models';
import { DEFAULT_TARGETS, suggestMicroTargets } from '../lib/targets';

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  theme: 'dark',
  weightUnit: 'kg',
  sound: true,
  allDailyBonusXp: 50,
  waterQuickAmounts: [100, 250, 500],
  seenBriefings: [],
};

/** Quick-add amounts shipped before v0.7; replaced by the new defaults on start-up. */
export const OLD_WATER_QUICK_AMOUNTS = [150, 250, 350, 500, 750];

export function defaultProfile(now = Date.now()): Profile {
  return {
    id: 'me',
    name: '',
    sex: 'male',
    age: 30,
    heightCm: 175,
    weightKg: 75,
    activity: 'moderate',
    objective: 'maintain',
    targets: { ...DEFAULT_TARGETS },
    microTargets: suggestMicroTargets('male', 30),
    customTargets: false,
    onboarded: false,
    createdAt: now,
    updatedAt: now,
  };
}

export interface QuestTemplate {
  key: string;
  title: string;
  category: QuestCategory;
  recurrence: QuestRecurrence;
  xp: number;
  icon: string;
  auto?: AutoRule;
  description?: string;
  /** Included in a fresh install. */
  starter: boolean;
}

/** Built-in quests. Starter quests are seeded on first run; all can be added from the template list. */
export const QUEST_TEMPLATES: QuestTemplate[] = [
  // Daily missions
  { key: 'water', title: 'Reach your water goal', category: 'daily', recurrence: 'daily', xp: 20, icon: 'droplet', auto: 'water', starter: true, description: 'Completes itself when your water goal is reached.' },
  { key: 'log-meals', title: 'Log breakfast, lunch and dinner', category: 'daily', recurrence: 'daily', xp: 20, icon: 'notebook-pen', auto: 'logMeals', starter: true, description: 'Completes itself once all three main meals have an entry.' },
  { key: 'protein', title: 'Reach your protein target', category: 'daily', recurrence: 'daily', xp: 30, icon: 'dumbbell', auto: 'protein', starter: true, description: 'Completes itself when you reach your protein target.' },
  { key: 'calories', title: 'Fuel within your calorie range', category: 'daily', recurrence: 'daily', xp: 20, icon: 'flame', auto: 'calorieRange', starter: true, description: 'Within ±10% of your target. Eating far less does not count, so fuel properly.' },
  { key: 'veg', title: 'Eat a portion of vegetables', category: 'daily', recurrence: 'daily', xp: 15, icon: 'carrot', starter: true },
  // Side quests
  { key: 'workout', title: 'Complete a workout', category: 'side', recurrence: 'daily', xp: 30, icon: 'swords', starter: true },
  { key: 'walk', title: 'Go for a walk', category: 'side', recurrence: 'daily', xp: 15, icon: 'footprints', starter: true },
  { key: 'stretch', title: 'Stretch for 10 minutes', category: 'side', recurrence: 'daily', xp: 10, icon: 'person-standing', starter: true },
  { key: 'read', title: 'Read for 15 minutes', category: 'side', recurrence: 'daily', xp: 10, icon: 'book-open', starter: true },
  { key: 'sleep', title: 'Get 8 hours of sleep', category: 'side', recurrence: 'daily', xp: 15, icon: 'moon', starter: true },
  { key: 'prep', title: "Prepare tomorrow's meals", category: 'side', recurrence: 'daily', xp: 15, icon: 'chef-hat', starter: true },
  { key: 'cardio', title: 'Complete a cardio session', category: 'side', recurrence: 'daily', xp: 25, icon: 'heart-pulse', starter: false },
  { key: 'snacking', title: 'Skip unplanned snacking today', category: 'side', recurrence: 'daily', xp: 10, icon: 'cookie', starter: false, description: 'Planned snacks are fine. This is about mindful choices, not restriction.' },
  { key: 'fiber', title: 'Reach your fibre target', category: 'side', recurrence: 'daily', xp: 15, icon: 'wheat', auto: 'fiber', starter: false },
  // Weekly objectives
  { key: 'weigh-in', title: 'Log your weekly weigh-in', category: 'weekly', recurrence: 'weekly', xp: 20, icon: 'scale', auto: 'weighIn', starter: true, description: 'Completes itself when you log a weight this week.' },
  { key: 'three-workouts', title: 'Train three times this week', category: 'weekly', recurrence: 'weekly', xp: 50, icon: 'calendar-check', starter: true },
  { key: 'new-recipe', title: 'Cook a new healthy recipe', category: 'weekly', recurrence: 'weekly', xp: 40, icon: 'chef-hat', starter: true },
  { key: 'long-walk', title: 'Take a long walk outdoors', category: 'weekly', recurrence: 'weekly', xp: 30, icon: 'mountain', starter: false },
  // Bonus challenges
  { key: 'personal-goal', title: 'Complete a personal goal', category: 'bonus', recurrence: 'once', xp: 50, icon: 'star', starter: true },
  { key: 'new-veg', title: 'Try a vegetable you have never cooked', category: 'bonus', recurrence: 'once', xp: 30, icon: 'sprout', starter: true },
];

export function questFromTemplate(t: QuestTemplate, id: string, order: number, now = Date.now()): Quest {
  return {
    id,
    title: t.title,
    description: t.description,
    category: t.category,
    recurrence: t.recurrence,
    xp: t.xp,
    auto: t.auto,
    icon: t.icon,
    order,
    createdAt: now,
  };
}
