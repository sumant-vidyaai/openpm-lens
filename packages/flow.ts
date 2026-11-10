import { parseDateText, type DateOrder } from './dates';
import type { DataIssue } from './model';
import { suggestStatusCategory } from './importTasks';
import type { StepGroup } from './explain';
import { roundHalfUp } from './format';

/**
 * Flow metrics: cycle time, throughput, work in progress (WIP) and work item age.
 *
 * Definitions follow the Kanban Guide (prokanban.org): WIP = items started but not finished;
 * throughput = items finished per unit of time; cycle time = elapsed time from started to
 * finished; work item age = elapsed time from started to now (here: the status date).
 *
 * The guide does not say how to count days or which percentile method to use, so these are OUR rules,
 * stated on screen:
 *  - days are calendar days, counted inclusively (started and finished on the same day = 1 day);
 *  - a percentile uses the nearest-rank method on the sorted values;
 *  - a percentile needs at least MIN_FLOW_SAMPLE finished items, otherwise it says "Insufficient data";
 *  - the window is the last N blocks of 7 days ending on the status date (not calendar weeks).
 * The status date is never assumed. Anything unclear is left out and listed, never guessed.
 */
export const MIN_FLOW_SAMPLE = 5;

export interface FlowColumns {
  id: string | null;
  name: string | null;
  status: string | null;
  start: string | null;
  done: string | null;
}

export interface FlowItem {
  id: string;
  name: string;
  start: string | null;
  done: string | null;
  cancelled: boolean;
  markedDone: boolean;
  issues: DataIssue[];
}

/** Guesses columns from header wording. "Created" is never guessed as a start date. */
export function suggestFlowColumns(headers: string[]): FlowColumns {
  const find = (res: RegExp[], not: string[] = []) => {
    for (const re of res) {
      const hit = headers.find((h) => !not.includes(h) && re.test(h.trim()));
      if (hit) return hit;
    }
    return null;
  };
  const name = find([/^(task |issue |item |work item )?(name|title|summary)$/i, /^task$/i]);
  const id = find([/^(task |issue |item )?(id|key|number|no\.?)$/i], name ? [name] : []);
  const status = find([/^status$/i, /state/i]);
  const start = find([/^(actual |work )?started( date)?$/i, /^(actual |work )?start( date)?$/i, /started/i]);
  const done = find([/^actual (finish|end|completion)( date)?$/i, /^(actual )?(done|resolved|closed|completed|finished)( date)?$/i, /resolved|closed date|done date|completed|finish(ed)? date/i], start ? [start] : []);
  return { id, name, status, start, done };
}

export function buildFlowItems(headers: string[], rows: string[][], cols: FlowColumns, order: DateOrder = 'auto'): FlowItem[] {
  const ix = (c: string | null) => (c === null ? -1 : headers.indexOf(c));
  const [iId, iName, iStatus, iStart, iDone] = [cols.id, cols.name, cols.status, cols.start, cols.done].map(ix) as [number, number, number, number, number];
  const cell = (r: string[], i: number) => (i < 0 ? '' : (r[i] ?? '').trim());
  return rows.map((r, n) => {
    const issues: DataIssue[] = [];
    const read = (i: number, field: string): string | null => {
      const text = cell(r, i);
      if (text === '') return null;
      const d = parseDateText(text, order, field);
      if (d.issue) issues.push(d.issue);
      return d.iso;
    };
    const status = cell(r, iStatus);
    const cat = status === '' ? null : suggestStatusCategory(status);
    return {
      id: cell(r, iId) || `row-${n + 2}`,
      name: cell(r, iName) || `(row ${n + 2} has no name)`,
      start: read(iStart, 'startedAt'),
      done: read(iDone, 'doneAt'),
      cancelled: cat === 'cancelled',
      markedDone: cat === 'done',
      issues,
    };
  });
}

export interface FlowSettings {
  /** ISO date; flow numbers are as of this date. Required, never assumed. */
  statusDate: string;
  /** Number of 7-day blocks, ending on the status date. */
  weeks: number;
}

export interface FlowExcluded { id: string; name: string; reason: string }
export interface AgingRow { id: string; name: string; start: string; age: number; olderThanP85: boolean | null }
export interface ThroughputBlock { from: string; to: string; count: number }
export interface CyclePoint { id: string; name: string; done: string; days: number }
export interface CycleStats {
  n: number;
  min: number;
  mean: number;
  p50: number | null;
  p85: number | null;
  max: number;
  values: number[];
}

export interface FlowResult {
  windowStart: string;
  windowEnd: string;
  throughput: ThroughputBlock[];
  throughputTotal: number;
  throughputPerWeek: number | null;
  cycle: CycleStats | null;
  /** One point per finished item with a start date in the window (for charts). */
  points: CyclePoint[];
  wip: number;
  aging: AgingRow[];
  excluded: FlowExcluded[];
  finishedBeforeWindow: number;
  finishedNoStart: number;
  total: number;
  caveats: string[];
  steps: StepGroup[];
}

const DAY = 86_400_000;
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(utc(s) + n * DAY);
/** Inclusive calendar-day count: same day = 1. */
export const inclusiveDays = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY) + 1;

/** Nearest-rank percentile of a list sorted ascending (p in 1..100). */
export function percentileNearestRank(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1] as number;
}

export function analyseFlow(items: FlowItem[], s: FlowSettings): FlowResult {
  const weeks = Math.max(1, Math.floor(s.weeks));
  const windowEnd = s.statusDate;
  const windowStart = addDays(s.statusDate, -(weeks * 7 - 1));
  const excluded: FlowExcluded[] = [];
  const out = (it: FlowItem, reason: string) => excluded.push({ id: it.id, name: it.name, reason });
  const throughput: ThroughputBlock[] = [];
  for (let w = 0; w < weeks; w++) {
    const to = addDays(s.statusDate, -7 * (weeks - 1 - w));
    throughput.push({ from: addDays(to, -6), to, count: 0 });
  }
  const cycleValues: number[] = [];
  const points: CyclePoint[] = [];
  const wipItems: { it: FlowItem; start: string }[] = [];
  let finishedBeforeWindow = 0;
  let finishedNoStart = 0;

  for (const it of items) {
    if (it.cancelled) { out(it, 'cancelled'); continue; }
    if (it.issues.length > 0) { out(it, `unclear or unreadable date (${it.issues.map((i) => i.field).join(', ')})`); continue; }
    if (it.markedDone && it.done === null) { out(it, 'marked done but has no done date'); continue; }
    if (it.start === null && it.done === null) { out(it, 'no start date and no done date'); continue; }
    if (it.start !== null && it.done !== null && it.done < it.start) { out(it, 'done date is before start date'); continue; }
    const finished = it.done !== null && it.done <= s.statusDate;
    if (finished) {
      const done = it.done as string;
      if (done < windowStart) { finishedBeforeWindow += 1; continue; }
      const block = throughput.find((b) => done >= b.from && done <= b.to);
      if (block) block.count += 1;
      if (it.start === null) finishedNoStart += 1;
      else { const d = inclusiveDays(it.start, done); cycleValues.push(d); points.push({ id: it.id, name: it.name, done, days: d }); }
    } else {
      if (it.start === null) { out(it, 'no start date and not finished by the status date'); continue; }
      if (it.start > s.statusDate) { out(it, 'starts after the status date'); continue; }
      wipItems.push({ it, start: it.start });
    }
  }

  const sorted = [...cycleValues].sort((a, b) => a - b);
  const reliable = sorted.length >= MIN_FLOW_SAMPLE;
  const cycle: CycleStats | null = sorted.length === 0 ? null : {
    n: sorted.length, min: sorted[0] as number, max: sorted[sorted.length - 1] as number,
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    p50: reliable ? percentileNearestRank(sorted, 50) : null,
    p85: reliable ? percentileNearestRank(sorted, 85) : null,
    values: sorted,
  };
  const aging: AgingRow[] = wipItems
    .map(({ it, start }) => {
      const age = inclusiveDays(start, s.statusDate);
      return { id: it.id, name: it.name, start, age, olderThanP85: cycle?.p85 == null ? null : age > cycle.p85 };
    })
    .sort((a, b) => b.age - a.age || a.id.localeCompare(b.id));
  const total = throughput.reduce((a, b) => a + b.count, 0);

  const caveats: string[] = [];
  if (excluded.length > 0) caveats.push(`${excluded.length} of ${items.length} items left out (see the list).`);
  if (finishedNoStart > 0) caveats.push(`${finishedNoStart} finished item${finishedNoStart === 1 ? ' has' : 's have'} no start date: counted in throughput, left out of cycle time.`);
  if (cycle !== null && !reliable) caveats.push(`Only ${cycle.n} finished item${cycle.n === 1 ? '' : 's'} with a start date: percentiles need at least ${MIN_FLOW_SAMPLE}, so they are not shown (Insufficient data).`);
  if (cycle === null) caveats.push('No finished item in the window has a start date, so cycle time is not available.');

  const n = (x: number | null, d = 1) => (x === null ? 'not available' : String(roundHalfUp(x, d)));
  const steps: StepGroup[] = [
    { label: 'The window', steps: [`Window = the last ${weeks} block${weeks === 1 ? '' : 's'} of 7 days, ${windowStart} to ${windowEnd}. Blocks are counted back from the status date, not calendar weeks.`] },
    { label: 'Throughput', steps: ['Throughput = items finished in a block of 7 days', ...throughput.map((b) => `${b.from} to ${b.to}: ${b.count}`), `Average = ${total} / ${weeks} = ${n(weeks > 0 ? total / weeks : null, 2)} per week`] },
    { label: 'Cycle time', steps: cycle === null
      ? ['Cycle time = done date - start date, counting both days (same day = 1 day)', 'No finished item with a start date in the window.']
      : ['Cycle time = days from start date to done date, counting both days (same day = 1 day)', `Finished items in the window with a start date: ${cycle.n}`, `Sorted: ${cycle.values.join(', ')}`, `Mean = ${n(cycle.mean, 2)} days; shortest ${cycle.min}; longest ${cycle.max}`] },
    { label: 'Percentiles (nearest rank)', steps: cycle === null || cycle.p50 === null || cycle.p85 === null
      ? [`Needs at least ${MIN_FLOW_SAMPLE} finished items. Not shown: Insufficient data.`]
      : [`Rank = round up (percentile / 100 x ${cycle.n}); value = the item at that rank in the sorted list`, `50th percentile: rank ${Math.ceil(0.5 * cycle.n)} -> ${cycle.p50} days`, `85th percentile: rank ${Math.ceil(0.85 * cycle.n)} -> ${cycle.p85} days (85% of these items took this long or less)`] },
    { label: 'Work in progress and age', steps: [`WIP = items started on or before ${s.statusDate} and not finished by then = ${wipItems.length}`, 'Age = days from start date to the status date, counting both days', ...(aging.slice(0, 5).map((a) => `${a.id}: ${a.start} to ${s.statusDate} = ${a.age} days`))] },
  ];
  return {
    windowStart, windowEnd, throughput, throughputTotal: total, throughputPerWeek: total / weeks, cycle, points, wip: wipItems.length, aging, excluded,
    finishedBeforeWindow, finishedNoStart, total: items.length, caveats, steps,
  };
}
