import type { DataIssue } from './model';

/**
 * Safe reading of dates that arrive as text.
 *
 * Principles (same as quantities): never guess. ISO dates (2026-03-04) and dates with a
 * month name (4 Mar 2026) are unambiguous. A date like 03/04/2026 could be 3 April or 4 March,
 * so it is refused unless the user says which order the file uses, or one part is above 12.
 */
export type DateOrder = 'auto' | 'dmy' | 'mdy';

export interface DateParse {
  /** ISO date YYYY-MM-DD, or null. */
  iso: string | null;
  issue: DataIssue | null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function valid(y: number, m: number, d: number): string | null {
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31) || y < 1900 || y > 2200) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

const fail = (field: string, code: DataIssue['code'], message: string): DateParse => ({
  iso: null,
  issue: { code, field, message },
});

export function parseDateText(input: string | null | undefined, order: DateOrder = 'auto', field = 'date'): DateParse {
  if (input === null || input === undefined || input.trim() === '') return { iso: null, issue: null };
  // Drop a leading weekday ("Mon 05/01/26") and a trailing time ("8:00 AM", "T08:00:00Z").
  let s = input.trim().replace(/^(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*,?\s+/i, '');
  s = s.replace(/[T\s]+\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(am|pm)?\s*(z|[+-]\d{2}:?\d{2})?$/i, '').trim();

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const iso = valid(Number(m[1]), Number(m[2]), Number(m[3]));
    return iso ? { iso, issue: null } : fail(field, 'unparseable', `"${input}" is not a real date.`);
  }

  // 4 Mar 2026, 4-Mar-2026, March 4, 2026
  m = /^(\d{1,2})[\s-]+([A-Za-z]+)[\s,-]+(\d{2}|\d{4})$/.exec(s);
  let day: number | undefined, mon: number | undefined, yr: number | undefined;
  if (m && MONTHS[(m[2] as string).toLowerCase()]) {
    day = Number(m[1]); mon = MONTHS[(m[2] as string).toLowerCase()]; yr = Number(m[3]);
  } else {
    m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/.exec(s);
    if (m && MONTHS[(m[1] as string).toLowerCase()]) {
      mon = MONTHS[(m[1] as string).toLowerCase()]; day = Number(m[2]); yr = Number(m[3]);
    }
  }
  if (day !== undefined && mon !== undefined && yr !== undefined) {
    if (yr < 100) yr += 2000;
    const iso = valid(yr, mon, day);
    return iso ? { iso, issue: null } : fail(field, 'unparseable', `"${input}" is not a real date.`);
  }

  // 03/04/2026, 3.4.26, 3-4-2026
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    let d: number, mo: number;
    if (order === 'dmy') { d = a; mo = b; }
    else if (order === 'mdy') { mo = a; d = b; }
    else if (a > 12 && b <= 12) { d = a; mo = b; }
    else if (b > 12 && a <= 12) { mo = a; d = b; }
    else if (a === b) { d = a; mo = b; }
    else {
      return fail(field, 'ambiguous_date', `"${input}" could be day/month or month/day. Choose the date order in step 2.`);
    }
    const iso = valid(y, mo, d);
    return iso ? { iso, issue: null } : fail(field, 'unparseable', `"${input}" is not a real date in that order.`);
  }
  return fail(field, 'unparseable', `"${input}" is not a recognisable date.`);
}

export type DayCount = 'weekdays' | 'calendar';

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};

/** Number of days from `from` to `to` inclusive (0 if to is before from). */
export function countDays(from: string, to: string, mode: DayCount): number {
  const a = toUtc(from), b = toUtc(to);
  if (b < a) return 0;
  const DAY = 86_400_000;
  let n = 0;
  for (let t = a; t <= b; t += DAY) {
    if (mode === 'calendar') n += 1;
    else {
      const wd = new Date(t).getUTCDay();
      if (wd !== 0 && wd !== 6) n += 1;
    }
  }
  return n;
}
