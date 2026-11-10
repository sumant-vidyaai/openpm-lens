import type { MetricStatus } from './result';
import { countDays, dayHolidays, dayMode, type DayRule } from './dates';
import { scheduleVariance, schedulePerformanceIndex } from './evm';

/**
 * Planned value (PV), earned value (EV), SPI and SV in hours, at a status date.
 *
 * Planned value spreads each task's planned hours evenly over its planned working days
 * (or calendar days). It is an assumption, stated on screen: real work is rarely even.
 * A task is used only when planned hours, progress and valid planned dates are all known.
 * Actual hours are not needed for schedule measures.
 */
export interface ScheduleTask {
  id: string;
  plannedHours: number | null;
  /** 0-100, already determined by the chosen percent-complete rule. */
  percentComplete: number | null;
  /** ISO dates (YYYY-MM-DD). */
  plannedStart: string | null;
  plannedFinish: string | null;
}

export interface ScheduleExcluded {
  id: string;
  reason: 'no planned hours' | 'no % complete' | 'no usable planned dates (missing or unclear)' | 'finish before start';
}

export interface ScheduleAggregate {
  status: MetricStatus;
  pv: number | null;
  ev: number | null;
  spi: number | null;
  sv: number | null;
  counts: { total: number; used: number; excluded: number };
  excluded: ScheduleExcluded[];
  caveats: string[];
  missing: string[];
}

/** Share (0-1) of a task's planned work that should be done by the status date. */
export function plannedFraction(start: string, finish: string, statusDate: string, mode: DayRule): number {
  if (statusDate < start) return 0;
  if (statusDate >= finish) return 1;
  const total = countDays(start, finish, mode);
  if (total === 0) return 0; // a span with no working days: due only at its finish date
  return Math.min(1, countDays(start, statusDate, mode) / total);
}

export function aggregateSchedule(tasks: ScheduleTask[], statusDate: string, mode: DayRule): ScheduleAggregate {
  let pv = 0, ev = 0, used = 0;
  const excluded: ScheduleExcluded[] = [];
  for (const t of tasks) {
    if (t.plannedHours === null || !Number.isFinite(t.plannedHours)) { excluded.push({ id: t.id, reason: 'no planned hours' }); continue; }
    if (t.percentComplete === null || !Number.isFinite(t.percentComplete)) { excluded.push({ id: t.id, reason: 'no % complete' }); continue; }
    if (t.plannedStart === null || t.plannedFinish === null) { excluded.push({ id: t.id, reason: 'no usable planned dates (missing or unclear)' }); continue; }
    if (t.plannedFinish < t.plannedStart) { excluded.push({ id: t.id, reason: 'finish before start' }); continue; }
    pv += t.plannedHours * plannedFraction(t.plannedStart, t.plannedFinish, statusDate, mode);
    ev += t.plannedHours * (t.percentComplete / 100);
    used += 1;
  }
  const total = tasks.length;
  const counts = { total, used, excluded: excluded.length };
  const caveats: string[] = [];
  if (excluded.length > 0) {
    const by = new Map<string, number>();
    for (const e of excluded) by.set(e.reason, (by.get(e.reason) ?? 0) + 1);
    const detail = [...by.entries()].map(([r, n]) => `${n} ${r}`).join('; ');
    caveats.push(`${excluded.length} of ${total} tasks excluded from schedule measures (${detail}).`);
  }
  const nHol = dayHolidays(mode).length;
  caveats.push(
    dayMode(mode) === 'weekdays'
      ? nHol > 0
        ? `Assumption: planned hours are spread evenly over Monday to Friday, leaving out the ${nHol} holiday${nHol === 1 ? '' : 's'} you listed.`
        : 'Assumption: planned hours are spread evenly over Monday to Friday; holidays are not known.'
      : 'Assumption: planned hours are spread evenly over every calendar day, weekends included.',
  );
  if (used === 0) {
    const missing = new Set<string>();
    for (const e of excluded) {
      missing.add(e.reason === 'no planned hours' ? 'plannedHours' : e.reason === 'no % complete' ? 'percentComplete' : 'plannedDates');
    }
    if (total === 0) missing.add('tasks');
    return { status: 'not_available', pv: null, ev: null, spi: null, sv: null, counts, excluded, caveats, missing: [...missing] };
  }
  return {
    status: 'computed_with_caveats', pv, ev,
    spi: schedulePerformanceIndex(ev, pv), sv: scheduleVariance(ev, pv),
    counts, excluded, caveats, missing: [],
  };
}
