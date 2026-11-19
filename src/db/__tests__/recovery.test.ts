import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { isConnectionLostError, nextRecoveryStep, reopenDatabase, resetRecoveryState } from '../recovery';

const domError = (name: string, message: string) => Object.assign(new Error(message), { name });

describe('isConnectionLostError', () => {
  it('recognises the iOS lost-connection errors', () => {
    expect(isConnectionLostError(domError('UnknownError', 'Unable to open cursor'))).toBe(true);
    expect(isConnectionLostError(domError('InvalidStateError', 'Connection to Indexed Database server lost. Refresh the page to try again'))).toBe(true);
    expect(isConnectionLostError(domError('DatabaseClosedError', 'Database has been closed'))).toBe(true);
  });

  it('looks through Dexie wrapper errors', () => {
    const wrapped = Object.assign(new Error('Transaction failed'), { name: 'AbortError', inner: domError('UnknownError', 'Unable to open cursor') });
    expect(isConnectionLostError(wrapped)).toBe(true);
  });

  it('ignores ordinary bugs and data errors', () => {
    expect(isConnectionLostError(new TypeError('x is undefined'))).toBe(false);
    expect(isConnectionLostError(domError('ConstraintError', 'Key already exists'))).toBe(false);
    expect(isConnectionLostError(domError('InvalidStateError', 'The object is in an invalid state'))).toBe(false);
    expect(isConnectionLostError(undefined)).toBe(false);
  });
});

describe('nextRecoveryStep', () => {
  beforeEach(resetRecoveryState);

  it('escalates reopen -> reload -> give up within the window', () => {
    const t = 1_000_000;
    expect(nextRecoveryStep(t)).toBe('reopen');
    expect(nextRecoveryStep(t + 1_000)).toBe('reload');
    expect(nextRecoveryStep(t + 2_000)).toBe('give-up');
  });

  it('starts again from a reopen once earlier failures are old', () => {
    const t = 1_000_000;
    expect(nextRecoveryStep(t)).toBe('reopen');
    expect(nextRecoveryStep(t + 1_000)).toBe('reload');
    expect(nextRecoveryStep(t + 60_000)).toBe('reopen');
  });

  it('remembers attempts across a page reload via sessionStorage', () => {
    const t = 1_000_000;
    nextRecoveryStep(t);
    nextRecoveryStep(t + 500);
    const saved = sessionStorage.getItem('nt-db-recovery');
    resetRecoveryState();
    sessionStorage.setItem('nt-db-recovery', saved!);
    expect(nextRecoveryStep(t + 1_000)).toBe('give-up');
  });
});

describe('reopenDatabase', () => {
  it('reopens the database with data intact', async () => {
    await db.table('settings').put({ id: 'probe' });
    await reopenDatabase();
    expect(db.isOpen()).toBe(true);
    expect(await db.table('settings').get('probe')).toBeTruthy();
    await db.table('settings').delete('probe');
  });
});
