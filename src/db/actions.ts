/**
 * Every write the UI performs goes through this module, so validation,
 * snapshots and the progression sync are applied consistently.
 */
import { celebrate } from '../lib/celebrations';
import { toDateKey, type DateKey } from '../lib/dates';
import { LIMITS, clamp } from '../lib/limits';
import type {
  DiaryEntry,
  Food,
  FoodSnapshot,
  MealSlot,
  Profile,
  Quest,
  SavedMeal,
  SavedMealItem,
  Settings,
} from '../lib/models';
import type { NutrientKey } from '../lib/nutrients';
import { makeQuestEvent, periodKey, questEventId } from '../lib/quests';
import { suggestMicroTargets, suggestTargets, type Targets } from '../lib/targets';
import { db, uid } from './db';
import { DEFAULT_SETTINGS, QUEST_TEMPLATES, defaultProfile, questFromTemplate } from './defaults';
import { withProgression } from './progression';

// ───────────────────────────── Initialisation ─────────────────────────────

/** Create the profile, settings and starter quests on first run. Idempotent. */
export async function ensureInitialized(): Promise<void> {
  await db.transaction('rw', db.profile, db.settings, db.quests, async () => {
    if (!(await db.profile.get('me'))) await db.profile.put(defaultProfile());
    const settings = await db.settings.get('settings');
    if (!settings) await db.settings.put({ ...DEFAULT_SETTINGS });
    else await db.settings.put({ ...DEFAULT_SETTINGS, ...settings });
    if ((await db.quests.count()) === 0) {
      const now = Date.now();
      const starters = QUEST_TEMPLATES.filter((t) => t.starter);
      await db.quests.bulkPut(starters.map((t, i) => questFromTemplate(t, uid(), i, now)));
    }
  });
}

// ───────────────────────────── Profile & settings ─────────────────────────────

export type ProfileInput = Pick<
  Profile,
  'name' | 'sex' | 'age' | 'heightCm' | 'weightKg' | 'goalWeightKg' | 'activity' | 'objective'
>;

/**
 * Save personal details. Unless the player has customised their targets,
 * targets are recalculated from the new details.
 */
export async function saveProfile(input: Partial<ProfileInput>, opts: { onboard?: boolean } = {}): Promise<void> {
  await withProgression(async () => {
    const current = (await db.profile.get('me')) ?? defaultProfile();
    const next: Profile = {
      ...current,
      ...input,
      name: (input.name ?? current.name).trim().slice(0, 40),
      age: clamp(Math.round(input.age ?? current.age), LIMITS.age.min, LIMITS.age.max),
      heightCm: clamp(input.heightCm ?? current.heightCm, LIMITS.heightCm.min, LIMITS.heightCm.max),
      weightKg: clamp(input.weightKg ?? current.weightKg, LIMITS.weightKg.min, LIMITS.weightKg.max),
      onboarded: opts.onboard ? true : current.onboarded,
      updatedAt: Date.now(),
    };
    if (!next.customTargets) {
      next.targets = suggestTargets(next);
      next.microTargets = suggestMicroTargets(next.sex, next.age);
    }
    await db.profile.put(next);
  }, { silent: opts.onboard });
}

export async function updateTargets(patch: Partial<Targets>): Promise<void> {
  await withProgression(async () => {
    const p = (await db.profile.get('me')) ?? defaultProfile();
    const targets = { ...p.targets };
    for (const [k, v] of Object.entries(patch) as [keyof Targets, number][]) {
      if (Number.isFinite(v) && v >= 0) targets[k] = Math.round(v);
    }
    await db.profile.put({ ...p, targets, customTargets: true, updatedAt: Date.now() });
  });
}

export async function resetTargetsToSuggested(): Promise<void> {
  await withProgression(async () => {
    const p = (await db.profile.get('me')) ?? defaultProfile();
    await db.profile.put({
      ...p,
      targets: suggestTargets(p),
      microTargets: suggestMicroTargets(p.sex, p.age),
      customTargets: false,
      updatedAt: Date.now(),
    });
  });
}

export async function updateMicroTarget(key: NutrientKey, value: number): Promise<void> {
  const p = (await db.profile.get('me')) ?? defaultProfile();
  if (!Number.isFinite(value) || value < 0) return;
  await db.profile.put({ ...p, microTargets: { ...p.microTargets, [key]: value }, customTargets: true, updatedAt: Date.now() });
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const s = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
  const next = { ...s, ...patch };
  next.allDailyBonusXp = clamp(Math.round(next.allDailyBonusXp), LIMITS.bonusXp.min, LIMITS.bonusXp.max);
  if ('allDailyBonusXp' in patch) await withProgression(() => db.settings.put(next));
  else await db.settings.put(next);
}

// ───────────────────────────── Foods ─────────────────────────────

export function toSnapshot(f: Pick<Food, 'name' | 'brand' | 'barcode' | 'imageUrl' | 'unit' | 'per100' | 'servings'>): FoodSnapshot {
  return {
    name: f.name,
    brand: f.brand,
    barcode: f.barcode,
    imageUrl: f.imageUrl,
    unit: f.unit,
    per100: { ...f.per100 },
    servings: f.servings.map((s) => ({ ...s })),
  };
}

/**
 * Save a product fetched from Open Food Facts. If the barcode is already
 * stored, refresh its nutrition data but keep favourites and usage stats.
 */
export async function saveOffFood(food: Omit<Food, 'id'>, opts: { scanned?: boolean } = {}): Promise<Food> {
  return withProgression(async () => {
    const existing = food.barcode ? await db.foods.where('barcode').equals(food.barcode).first() : undefined;
    const now = Date.now();
    const saved: Food = existing
      ? {
          ...existing,
          name: food.name,
          brand: food.brand,
          imageUrl: food.imageUrl ?? existing.imageUrl,
          unit: food.unit,
          per100: food.per100,
          servings: food.servings.length ? food.servings : existing.servings,
          scanned: existing.scanned || opts.scanned,
          updatedAt: now,
        }
      : { ...food, id: uid(), scanned: opts.scanned, createdAt: now, updatedAt: now };
    await db.foods.put(saved);
    return saved;
  });
}

export type CustomFoodInput = Pick<Food, 'name' | 'brand' | 'unit' | 'per100' | 'servings' | 'barcode'>;

export async function saveCustomFood(input: CustomFoodInput, id?: string): Promise<Food> {
  const now = Date.now();
  const existing = id ? await db.foods.get(id) : undefined;
  const food: Food = {
    favorite: false,
    useCount: 0,
    createdAt: now,
    ...existing,
    id: existing?.id ?? uid(),
    name: input.name.trim().slice(0, LIMITS.foodName) || 'Custom food',
    brand: input.brand?.trim() || undefined,
    barcode: input.barcode?.trim() || undefined,
    unit: input.unit,
    per100: input.per100,
    servings: input.servings.filter((s) => s.amount > 0 && s.label.trim()),
    source: existing?.source ?? 'custom',
    updatedAt: now,
  };
  await db.foods.put(food);
  return food;
}

export async function toggleFavorite(foodId: string): Promise<void> {
  const f = await db.foods.get(foodId);
  if (f) await db.foods.put({ ...f, favorite: !f.favorite, updatedAt: Date.now() });
}

export async function deleteFood(foodId: string): Promise<void> {
  // Diary entries keep their own snapshot, so history is unaffected.
  await db.foods.delete(foodId);
}

// ───────────────────────────── Diary ─────────────────────────────

export interface AddEntryInput {
  date: DateKey;
  meal: MealSlot;
  food: Food | FoodSnapshot;
  foodId?: string;
  amount: number;
  servingLabel?: string;
}

function validAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter an amount greater than zero.');
  return clamp(amount, LIMITS.amount.min, LIMITS.amount.max);
}

export async function addDiaryEntry(input: AddEntryInput): Promise<DiaryEntry> {
  return withProgression(async () => {
    const foodId = input.foodId ?? ('id' in input.food ? input.food.id : undefined);
    const entry: DiaryEntry = {
      id: uid(),
      date: input.date,
      meal: input.meal,
      foodId,
      food: toSnapshot(input.food),
      amount: validAmount(input.amount),
      servingLabel: input.servingLabel,
      createdAt: Date.now(),
    };
    await db.diary.put(entry);
    if (foodId) {
      const f = await db.foods.get(foodId);
      if (f) await db.foods.put({ ...f, lastUsedAt: Date.now(), useCount: f.useCount + 1 });
    }
    return entry;
  });
}

export async function updateDiaryEntry(id: string, patch: Partial<Pick<DiaryEntry, 'amount' | 'meal' | 'servingLabel'>>): Promise<void> {
  await withProgression(async () => {
    const e = await db.diary.get(id);
    if (!e) return;
    await db.diary.put({
      ...e,
      ...patch,
      amount: patch.amount !== undefined ? validAmount(patch.amount) : e.amount,
    });
  });
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  await withProgression(() => db.diary.delete(id));
}

/** Copy every entry from one meal slot on one day into another day/slot. */
export async function copyMeal(fromDate: DateKey, fromMeal: MealSlot, toDate: DateKey, toMeal: MealSlot = fromMeal): Promise<number> {
  return withProgression(async () => {
    const src = await db.diary.where('[date+meal]').equals([fromDate, fromMeal]).toArray();
    const now = Date.now();
    await db.diary.bulkPut(src.map((e, i) => ({ ...e, id: uid(), date: toDate, meal: toMeal, createdAt: now + i })));
    return src.length;
  });
}

// ───────────────────────────── Saved meals ─────────────────────────────

export async function saveMealFromDiary(name: string, date: DateKey, meal: MealSlot): Promise<SavedMeal | null> {
  const entries = await db.diary.where('[date+meal]').equals([date, meal]).sortBy('createdAt');
  if (entries.length === 0) return null;
  const saved: SavedMeal = {
    id: uid(),
    name: name.trim().slice(0, 60) || 'Saved meal',
    items: entries.map((e) => ({ foodId: e.foodId, food: e.food, amount: e.amount, servingLabel: e.servingLabel })),
    createdAt: Date.now(),
  };
  await db.meals.put(saved);
  return saved;
}

export async function updateSavedMeal(id: string, patch: { name?: string; items?: SavedMealItem[] }): Promise<void> {
  const m = await db.meals.get(id);
  if (m) await db.meals.put({ ...m, ...patch, name: (patch.name ?? m.name).trim() || m.name });
}

export async function deleteSavedMeal(id: string): Promise<void> {
  await db.meals.delete(id);
}

export async function addSavedMealToDiary(mealId: string, date: DateKey, slot: MealSlot): Promise<number> {
  return withProgression(async () => {
    const m = await db.meals.get(mealId);
    if (!m) return 0;
    const now = Date.now();
    await db.diary.bulkPut(
      m.items.map((it, i) => ({
        id: uid(),
        date,
        meal: slot,
        foodId: it.foodId,
        food: it.food,
        amount: it.amount,
        servingLabel: it.servingLabel,
        createdAt: now + i,
      })),
    );
    await db.meals.put({ ...m, lastUsedAt: now });
    return m.items.length;
  });
}

// ───────────────────────────── Water ─────────────────────────────

function validWater(ml: number): number {
  if (!Number.isFinite(ml) || ml <= 0) throw new Error('Enter an amount greater than zero.');
  return Math.round(clamp(ml, LIMITS.waterMl.min, LIMITS.waterMl.max));
}

export async function addWater(date: DateKey, ml: number): Promise<void> {
  await withProgression(() => db.water.put({ id: uid(), date, ml: validWater(ml), createdAt: Date.now() }));
}

export async function updateWater(id: string, ml: number): Promise<void> {
  await withProgression(async () => {
    const w = await db.water.get(id);
    if (w) await db.water.put({ ...w, ml: validWater(ml) });
  });
}

export async function deleteWater(id: string): Promise<void> {
  await withProgression(() => db.water.delete(id));
}

// ───────────────────────────── Weight ─────────────────────────────

/** One weigh-in per day: logging again on the same day replaces it. */
export async function logWeight(date: DateKey, kg: number, note?: string): Promise<void> {
  if (!Number.isFinite(kg) || kg < LIMITS.weightKg.min || kg > LIMITS.weightKg.max) {
    throw new Error('That weight looks out of range.');
  }
  await withProgression(async () => {
    const existing = await db.weights.where('date').equals(date).first();
    await db.weights.put({
      id: existing?.id ?? uid(),
      date,
      kg: Math.round(kg * 100) / 100,
      note: note?.trim() || undefined,
      createdAt: existing?.createdAt ?? Date.now(),
    });
    // Keep the profile weight in step with the most recent weigh-in.
    const latest = await db.weights.orderBy('date').last();
    const p = await db.profile.get('me');
    if (p && latest && latest.date === date) {
      const next = { ...p, weightKg: latest.kg, updatedAt: Date.now() };
      if (!p.customTargets) next.targets = suggestTargets(next);
      await db.profile.put(next);
    }
  });
}

export async function updateWeight(id: string, patch: { kg?: number; date?: DateKey; note?: string }): Promise<void> {
  await withProgression(async () => {
    const w = await db.weights.get(id);
    if (!w) return;
    if (patch.date && patch.date !== w.date) {
      const clash = await db.weights.where('date').equals(patch.date).first();
      if (clash) await db.weights.delete(clash.id);
    }
    await db.weights.put({ ...w, ...patch });
  });
}

export async function deleteWeight(id: string): Promise<void> {
  await withProgression(() => db.weights.delete(id));
}

// ───────────────────────────── Quests ─────────────────────────────

/**
 * Tick or untick a manual quest for the period containing `date`.
 * Because the ledger id is deterministic, re-ticking can never pay twice.
 */
export async function toggleQuest(questId: string, date: DateKey = toDateKey()): Promise<boolean> {
  return withProgression(async () => {
    const q = await db.quests.get(questId);
    if (!q || q.auto) return false;
    const id = questEventId(q.id, periodKey(q, date));
    const existing = await db.xpEvents.get(id);
    if (existing) {
      await db.xpEvents.delete(id);
      return false;
    }
    const ev = makeQuestEvent(q, date, Date.now());
    await db.xpEvents.put(ev);
    celebrate({ kind: 'quest', title: q.title, xp: q.xp });
    return true;
  }, { today: date });
}

export type QuestInput = Pick<Quest, 'title' | 'category' | 'recurrence' | 'xp' | 'icon'> & Partial<Pick<Quest, 'description' | 'auto'>>;

function cleanQuest(input: QuestInput): QuestInput {
  return {
    ...input,
    title: input.title.trim().slice(0, LIMITS.questTitle) || 'New quest',
    description: input.description?.trim() || undefined,
    xp: clamp(Math.round(input.xp), LIMITS.questXp.min, LIMITS.questXp.max),
  };
}

export async function createQuest(input: QuestInput): Promise<Quest> {
  return withProgression(async () => {
    const last = await db.quests.orderBy('order').last();
    const q: Quest = { ...cleanQuest(input), id: uid(), order: (last?.order ?? 0) + 1, createdAt: Date.now() };
    await db.quests.put(q);
    return q;
  });
}

export async function addQuestFromTemplate(key: string): Promise<Quest | null> {
  const t = QUEST_TEMPLATES.find((x) => x.key === key);
  if (!t) return null;
  return createQuest({ title: t.title, category: t.category, recurrence: t.recurrence, xp: t.xp, icon: t.icon, auto: t.auto, description: t.description });
}

export async function updateQuest(id: string, patch: Partial<QuestInput>): Promise<void> {
  await withProgression(async () => {
    const q = await db.quests.get(id);
    if (!q) return;
    await db.quests.put({ ...q, ...cleanQuest({ ...q, ...patch }) });
  });
}

/** Delete a quest definition. XP already earned from it stays in your history. */
export async function deleteQuest(id: string): Promise<void> {
  await withProgression(() => db.quests.delete(id));
}
