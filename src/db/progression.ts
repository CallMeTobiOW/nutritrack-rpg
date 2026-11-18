/**
 * Progression engine. After every change to tracked data we:
 *   1. reconcile auto-tracked quests and the daily-missions bonus for today,
 *   2. unlock any achievements that are now earned (each pays XP once),
 *   3. report what changed so the UI can celebrate it.
 *
 * All work is serialised through a single promise chain so rapid taps can
 * never interleave and double-count.
 */
import { ACHIEVEMENTS, newlyUnlocked, type AchievementDef } from '../lib/achievements';
import { celebrate } from '../lib/celebrations';
import { toDateKey, toWeekKey, type DateKey } from '../lib/dates';
import type { XpEvent } from '../lib/models';
import { achievementEventId, computeDayMetrics, reconcileQuests } from '../lib/quests';
import { computePlayerStats, totalXp } from '../lib/stats';
import { levelFromXp, rankTitle } from '../lib/xp';
import { db } from './db';
import { DEFAULT_SETTINGS, defaultProfile } from './defaults';

export interface SyncReport {
  completed: XpEvent[];
  uncompleted: string[];
  bonus: XpEvent | null;
  unlocked: AchievementDef[];
}

const PROGRESSION_TABLES = ['profile', 'settings', 'quests', 'diary', 'water', 'weights', 'xpEvents', 'achievements', 'foods'] as const;

async function syncNow(today: DateKey, now = Date.now()): Promise<SyncReport> {
  return db.transaction('rw', PROGRESSION_TABLES.map((t) => db[t]), async () => {
    const [profile, settings, quests, diary, water, weights, eventRows, unlockRows, foods] = await Promise.all([
      db.profile.get('me'),
      db.settings.get('settings'),
      db.quests.toArray(),
      db.diary.toArray(),
      db.water.toArray(),
      db.weights.toArray(),
      db.xpEvents.toArray(),
      db.achievements.toArray(),
      db.foods.toArray(),
    ]);
    const targets = (profile ?? defaultProfile()).targets;
    const bonusXp = (settings ?? DEFAULT_SETTINGS).allDailyBonusXp;
    const events = new Map(eventRows.map((e) => [e.id, e]));

    // 1. Quests
    const week = toWeekKey(today);
    const ctx = {
      day: computeDayMetrics(
        today,
        diary.filter((e) => e.date === today),
        water.filter((e) => e.date === today),
        weights.filter((e) => e.date === today),
      ),
      weekHasWeighIn: weights.some((w) => toWeekKey(w.date) === week),
      targets,
    };
    const { add, remove } = reconcileQuests(quests, events, ctx, bonusXp, now);
    for (const id of remove) events.delete(id);
    for (const e of add) events.set(e.id, e);
    if (remove.length) await db.xpEvents.bulkDelete(remove);
    if (add.length) await db.xpEvents.bulkPut(add);

    // 2. Achievements (looped because achievement XP can unlock level badges)
    const unlockedIds = new Set(unlockRows.map((u) => u.id));
    const unlocked: AchievementDef[] = [];
    for (let pass = 0; pass < 5; pass++) {
      const stats = computePlayerStats({ diary, water, weights, events: [...events.values()], foods, quests, targets, today });
      const fresh = newlyUnlocked(stats, unlockedIds);
      if (fresh.length === 0) break;
      for (const a of fresh) {
        unlockedIds.add(a.id);
        unlocked.push(a);
        const ev: XpEvent = {
          id: achievementEventId(a.id),
          kind: 'achievement',
          refId: a.id,
          period: 'once',
          date: today,
          xp: a.xp,
          title: a.title,
          createdAt: now,
        };
        events.set(ev.id, ev);
        await db.achievements.put({ id: a.id, unlockedAt: now, date: today });
        await db.xpEvents.put(ev);
      }
    }

    return {
      completed: add.filter((e) => e.kind === 'quest'),
      uncompleted: remove,
      bonus: add.find((e) => e.kind === 'bonus') ?? null,
      unlocked,
    };
  });
}

async function currentLevel(): Promise<number> {
  return levelFromXp(totalXp(await db.xpEvents.toArray())).level;
}

let chain: Promise<unknown> = Promise.resolve();

export interface MutationOptions {
  /** Suppress celebrations (used for imports and app start-up). */
  silent?: boolean;
  today?: DateKey;
}

/**
 * Run a data mutation, then the progression sync, as one serialised step.
 * Returns whatever the mutation returns.
 */
export function withProgression<T>(mutation: () => Promise<T>, opts: MutationOptions = {}): Promise<T> {
  const run = async () => {
    const levelBefore = await currentLevel();
    const result = await mutation();
    const report = await syncNow(opts.today ?? toDateKey());
    const levelAfter = await currentLevel();
    if (!opts.silent) {
      for (const q of report.completed) celebrate({ kind: 'quest', title: q.title, xp: q.xp });
      if (report.bonus) celebrate({ kind: 'bonus', title: report.bonus.title, xp: report.bonus.xp });
      for (const a of report.unlocked) celebrate({ kind: 'achievement', id: a.id, title: a.title, xp: a.xp });
      if (levelAfter > levelBefore) celebrate({ kind: 'level', level: levelAfter, title: rankTitle(levelAfter) });
    }
    return result;
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

/** Re-run the sync without a mutation (app start, day change, target edits). */
export function syncProgression(opts: MutationOptions = {}): Promise<void> {
  return withProgression(async () => undefined, opts);
}

export { ACHIEVEMENTS };
