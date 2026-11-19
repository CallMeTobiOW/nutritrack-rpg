/**
 * A tiny in-memory event bus for celebratory feedback (quest complete,
 * achievement unlocked, level up). The UI subscribes with
 * useSyncExternalStore; nothing here is persisted.
 */
import type { TierId } from './rank';

export type Celebration =
  | { kind: 'quest'; title: string; xp: number }
  | { kind: 'bonus'; title: string; xp: number }
  | { kind: 'achievement'; id: string; title: string; xp: number }
  | { kind: 'level'; level: number; title: string }
  | { kind: 'badge'; id: string; icon: string; tier: TierId; title: string };

export interface QueuedCelebration {
  key: number;
  item: Celebration;
}

let queue: QueuedCelebration[] = [];
let counter = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function celebrate(item: Celebration): void {
  queue = [...queue, { key: ++counter, item }];
  emit();
}

export function dismissCelebration(key: number): void {
  queue = queue.filter((q) => q.key !== key);
  emit();
}

export function subscribeCelebrations(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCelebrations(): QueuedCelebration[] {
  return queue;
}
