import type { DataIssue } from './model';
import type { StepGroup } from './explain';
import { roundHalfUp } from './format';
import { percentileNearestRank, MIN_FLOW_SAMPLE } from './flow';

/**
 * Finish dates: planned vs actual.
 *
 * For each task finished by the status date: variance = actual finish - planned finish, in calendar
 * days (positive = late, 0 = on the planned day, negative = early). "On time" means finished on or
 * before the planned finish date. For each task not finished: overdue = status date - planned finish
 * when the planned finish has passed.
 *
 * These are plain arithmetic rules of this app, not a standard. A rate such as "on time %" is shown only
 * with at least MIN_FLOW_SAMPLE finished tasks, otherwise "Insufficient data". Nothing is guessed:
 * tasks with unclear dates, no planned finish, or marked done without a finish date are left out and listed.
 */
export interface FinishItem {
  id: string;
  name: string;
  plannedFinish: string | null;
  actualFinish: string | null;
  cancelled: boolean;
  markedDone: boolean;
  issues: DataIssue[];
}

export interface FinishRow { id: string; name: string; plannedFinish: string; actualFinish: string | null; days: number }
export interface FinishExcluded { id: string; name: string; reason: string }

export interface FinishResult {
  total: number;
  finished: number;
  onTime: number;
  late: number;
  /** Share (0-100) finished on or before the planned finish; null when too few finished tasks. */
  onTimePercent: number | null;
  meanVariance: number | null;
  medianVariance: number | null;
  worstLate: number | null;
  rows: FinishRow[];
  overdue: FinishRow[];
  notYetDue: number;
  excluded: FinishExcluded[];
  caveats: string[];
  steps: StepGroup[];
}

const DAY = 86_400_000;
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
/** Signed calendar days from a to b (b later = positive). */
export const diffDays = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY);

export function analyseFinish(items: FinishItem[], statusDate: string): FinishResult {
  const excluded: FinishExcluded[] = [];
  const rows: FinishRow[] = [];
  const overdue: FinishRow[] = [];
  let notYetDue = 0;
  const out = (it: FinishItem, reason: string) => excluded.push({ id: it.id, name: it.name, reason });
  for (const it of items) {
    if (it.cancelled) { out(it, 'cancelled'); continue; }
    if (it.issues.length > 0) { out(it, `unclear or unreadable date (${it.issues.map((i) => i.field).join(', ')})`); continue; }
    if (it.plannedFinish === null) { out(it, 'no planned finish date'); continue; }
    if (it.markedDone && it.actualFinish === null) { out(it, 'marked done but has no finish date'); continue; }
    const finished = it.actualFinish !== null && it.actualFinish <= statusDate;
    if (finished) {
      rows.push({ id: it.id, name: it.name, plannedFinish: it.plannedFinish, actualFinish: it.actualFinish, days: diffDays(it.plannedFinish, it.actualFinish as string) });
    } else if (it.plannedFinish < statusDate) {
      overdue.push({ id: it.id, name: it.name, plannedFinish: it.plannedFinish, actualFinish: null, days: diffDays(it.plannedFinish, statusDate) });
    } else notYetDue += 1;
  }
  overdue.sort((a, b) => b.days - a.days || a.id.localeCompare(b.id));
  const days = rows.map((r) => r.days).sort((a, b) => a - b);
  const onTime = rows.filter((r) => r.days <= 0).length;
  const reliable = rows.length >= MIN_FLOW_SAMPLE;
  const mean = rows.length === 0 ? null : days.reduce((a, b) => a + b, 0) / days.length;
  const median = reliable ? percentileNearestRank(days, 50) : null;
  const caveats: string[] = [];
  if (excluded.length > 0) caveats.push(`${excluded.length} of ${items.length} tasks left out (see the list).`);
  if (rows.length > 0 && !reliable) caveats.push(`Only ${rows.length} finished task${rows.length === 1 ? '' : 's'}: on-time percentage and median need at least ${MIN_FLOW_SAMPLE} (Insufficient data).`);
  if (rows.length === 0) caveats.push('No finished task has both a planned and an actual finish date, so finish variance is not available.');
  const n = (x: number | null, d = 1) => (x === null ? 'not available' : String(roundHalfUp(x, d)));
  const steps: StepGroup[] = [
    { label: 'Finish variance', steps: ['Variance = actual finish date - planned finish date, in calendar days (positive = late)', ...rows.slice(0, 5).map((r) => `${r.id}: ${r.actualFinish} - ${r.plannedFinish} = ${r.days} days`), rows.length > 5 ? `... and ${rows.length - 5} more` : `Finished tasks measured: ${rows.length}`] },
    { label: 'On time', steps: ['On time = finished on or before the planned finish date', `On time = ${onTime} of ${rows.length}`, reliable ? `On-time % = ${onTime} / ${rows.length} = ${n((onTime / rows.length) * 100, 0)}%` : `Fewer than ${MIN_FLOW_SAMPLE} finished tasks: percentage not shown (Insufficient data)`] },
    { label: 'Overdue (not finished)', steps: [`Overdue = planned finish is before the status date (${statusDate}) and the task is not finished by then`, 'Days overdue = status date - planned finish', `Overdue tasks: ${overdue.length}; not yet due: ${notYetDue}`] },
  ];
  return {
    total: items.length, finished: rows.length, onTime, late: rows.length - onTime,
    onTimePercent: reliable ? roundHalfUp((onTime / rows.length) * 100, 0) : null,
    meanVariance: mean, medianVariance: median, worstLate: rows.length === 0 ? null : Math.max(...days),
    rows, overdue, notYetDue, excluded, caveats, steps,
  };
}
