/**
 * Recovery from lost IndexedDB connections.
 *
 * iOS Safari (especially home-screen web apps) can silently break the
 * IndexedDB connection while the app is suspended in the background. The next
 * read then fails with errors such as "UnknownError: Unable to open cursor" or
 * "Connection to Indexed Database server lost". The data itself is fine; the
 * connection just has to be reopened (or, if that is not enough, the page
 * reloaded).
 *
 * Recovery escalates within a short window so it can never loop:
 *   1st failure  -> close and reopen the database, then re-render
 *   2nd failure  -> reload the page
 *   3rd failure  -> give up and show the recovery screen
 */
import { db } from './db';

const STORAGE_KEY = 'nt-db-recovery';
const WINDOW_MS = 30_000;

export type RecoveryStep = 'reopen' | 'reload' | 'give-up';

/** True for errors that mean the connection broke, not that our query was wrong. */
export function isConnectionLostError(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 3; depth++) {
    const { name = '', message = '' } = e as { name?: string; message?: string };
    if (name === 'UnknownError' || name === 'DatabaseClosedError') return true;
    if (name === 'InvalidStateError' && /connection|closing|closed|database/i.test(message)) return true;
    if (/Connection to Indexed Database server lost|Unable to open cursor/i.test(message)) return true;
    e = (e as { inner?: unknown }).inner;
  }
  return false;
}

function readAttempts(now: number): number[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((t): t is number => typeof t === 'number' && now - t < WINDOW_MS) : [];
  } catch {
    return [];
  }
}

function writeAttempts(list: number[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: escalation then relies on the in-memory count */
  }
}

let memoryAttempts: number[] = [];

/** Decide (and record) the next recovery step. Exported for tests. */
export function nextRecoveryStep(now = Date.now()): RecoveryStep {
  const stored = readAttempts(now);
  const inMemory = memoryAttempts.filter((t) => now - t < WINDOW_MS);
  const list = [...(stored.length >= inMemory.length ? stored : inMemory), now];
  memoryAttempts = list;
  writeAttempts(list);
  return list.length === 1 ? 'reopen' : list.length === 2 ? 'reload' : 'give-up';
}

/** Close and reopen the shared Dexie instance. */
export async function reopenDatabase(): Promise<void> {
  db.close({ disableAutoOpen: false });
  await db.open();
}

let inFlight: Promise<RecoveryStep> | null = null;

/**
 * Run the next recovery step. Resolves 'reopen' once the database is open
 * again (the caller should re-render), never resolves for 'reload', and
 * resolves 'give-up' when the caller should show the error.
 */
export function recoverConnection(): Promise<RecoveryStep> {
  inFlight ??= (async () => {
    const step = nextRecoveryStep();
    if (step === 'reload') {
      location.reload();
      return new Promise<RecoveryStep>(() => {});
    }
    if (step === 'reopen') {
      try {
        await reopenDatabase();
      } catch {
        location.reload();
        return new Promise<RecoveryStep>(() => {});
      }
    }
    return step;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** For tests. */
export function resetRecoveryState() {
  memoryAttempts = [];
  inFlight = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
