import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useDayMetrics, useEventMap, useProfile, useQuests } from '../../hooks/useData';
import { toWeekKey, type DateKey } from '../../lib/dates';
import type { Quest, QuestCategory } from '../../lib/models';
import { boardProgress, isQuestComplete, isQuestVisible, type DayMetrics } from '../../lib/quests';
import type { Targets } from '../../lib/targets';
import { formatVolume } from '../../lib/units';

export function autoProgressText(q: Quest, m: DayMetrics | undefined, t: Targets, weekHasWeighIn: boolean): string | undefined {
  if (!q.auto || !m) return undefined;
  const r = (v: number) => Math.round(v);
  switch (q.auto) {
    case 'water':
      return `${formatVolume(m.waterMl)} / ${formatVolume(t.waterMl)}`;
    case 'protein':
      return `${r(m.totals.protein.value)} / ${t.protein} g protein`;
    case 'fiber':
      return `${r(m.totals.fiber.value)} / ${t.fiber} g fibre`;
    case 'calorieRange':
      return `${r(m.totals.energy.value).toLocaleString()} kcal · aim ${r(t.calories * 0.9).toLocaleString()}–${r(t.calories * 1.1).toLocaleString()}`;
    case 'logMeals': {
      const n = [m.meals.breakfast, m.meals.lunch, m.meals.dinner].filter((x) => x > 0).length;
      return `${n} / 3 main meals logged`;
    }
    case 'weighIn':
      return weekHasWeighIn ? 'Weighed in this week' : 'Log a weight this week';
  }
}

export const CATEGORY_ORDER: QuestCategory[] = ['daily', 'side', 'weekly', 'bonus'];

export function useQuestBoard(today: DateKey) {
  const quests = useQuests();
  const events = useEventMap();
  const metrics = useDayMetrics(today);
  const profile = useProfile();
  const week = toWeekKey(today);
  const weekHasWeighIn = useLiveQuery(
    async () => (await db.weights.toArray()).some((w) => toWeekKey(w.date) === week),
    [week],
  );

  return useMemo(() => {
    if (!quests || !events) return undefined;
    const ids = new Set(events.keys());
    const visible = quests.filter((q) => isQuestVisible(q, today, events));
    const byCategory = new Map<QuestCategory, Quest[]>(CATEGORY_ORDER.map((c) => [c, visible.filter((q) => q.category === c)]));
    return {
      quests,
      visible,
      byCategory,
      events,
      isDone: (q: Quest) => isQuestComplete(q, today, ids),
      progress: boardProgress(quests, today, events),
      dailyProgress: boardProgress(quests.filter((q) => q.category === 'daily'), today, events),
      autoText: (q: Quest) => autoProgressText(q, metrics, profile.targets, !!weekHasWeighIn),
    };
  }, [quests, events, metrics, profile.targets, weekHasWeighIn, today]);
}
