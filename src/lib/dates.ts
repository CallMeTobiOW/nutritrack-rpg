/**
 * Local-date helpers.
 *
 * Every "day" in NutriTrack is a local calendar day expressed as a
 * `YYYY-MM-DD` key. We never use `toISOString()` for day keys because it
 * converts to UTC, which would roll the day over at the wrong time for
 * anyone not living on GMT.
 */

export type DateKey = string; // YYYY-MM-DD (local)
export type WeekKey = string; // YYYY-Www (ISO week, Monday start)

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date = new Date()): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse a date key as local midnight. */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Calendar arithmetic on date keys. Done in UTC so it is pure calendar maths:
 * a local day that a time zone skipped (e.g. Pacific/Apia, 2011-12-30) would
 * otherwise normalise back to itself and stall loops that step by days.
 */
export function addDays(key: DateKey, days: number): DateKey {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from a to b (b - a). DST-safe because we round. */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000);
}

/** Inclusive list of date keys from start to end. */
export function dateRange(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

/** The last `n` days ending on (and including) `end`. */
export function lastNDays(end: DateKey, n: number): DateKey[] {
  return dateRange(addDays(end, -(n - 1)), end);
}

/** ISO-8601 week key (weeks start Monday, week 1 contains the first Thursday). */
export function toWeekKey(key: DateKey): WeekKey {
  const d = fromDateKey(key);
  const day = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - day + 3);
  const isoYear = thursday.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(isoYear, 0, 4 - jan4Day);
  const week = 1 + Math.round((thursday.getTime() - week1Monday.getTime() - 3 * 86_400_000) / (7 * 86_400_000));
  return `${isoYear}-W${pad(week)}`;
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: DateKey): DateKey {
  const d = fromDateKey(key);
  const day = (d.getDay() + 6) % 7;
  return addDays(key, -day);
}

export function formatLongDate(key: DateKey, locale?: string): string {
  return fromDateKey(key).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatShortDate(key: DateKey, locale?: string): string {
  return fromDateKey(key).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function formatWeekday(key: DateKey, locale?: string): string {
  return fromDateKey(key).toLocaleDateString(locale, { weekday: 'short' });
}

export function formatTime(ts: number, locale?: string): string {
  return new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Milliseconds until the next local midnight (used to refresh "today"). */
export function msUntilNextMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function greetingFor(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
