import { useEffect, useState } from 'react';
import { msUntilNextMidnight, toDateKey, type DateKey } from '../lib/dates';

/**
 * The current local date key. Updates at midnight and whenever the app
 * returns to the foreground (iOS suspends timers in the background).
 */
export function useToday(): DateKey {
  const [today, setToday] = useState(toDateKey);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => setToday((prev) => (prev === toDateKey() ? prev : toDateKey()));
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, msUntilNextMidnight() + 500);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        schedule();
      }
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
  return today;
}
