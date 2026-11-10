import { dayCounter, type DayRule } from './dates';

/**
 * Time-phasing: spreading an amount (hours or money) over the counted days between two dates, evenly.
 * Used for the actual-cost line and the monthly cash-flow view.
 *
 * The spread is an ASSUMPTION of this app, stated on screen: work and spending are not recorded day by day in a
 * task list, so each task's amount is spread evenly over its counted days. A task with no counted day in its span
 * (for example a weekend only) is put on its end date. Tasks without usable dates are left out and listed, never guessed.
 */
export interface SpreadItem {
  id: string;
  amount: number | null;
  start: string | null;
  end: string | null;
}
export interface SpreadLeft { id: string; reason: string }
export interface SpreadResult {
  /** Amount by ISO day. */
  days: Map<string, number>;
  /** Sum of the amounts that were spread. */
  spread: number;
  /** Sum of the amounts of items with an amount above 0 (spread or not). */
  total: number;
  left: SpreadLeft[];
}

const DAY = 86_400_000;
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number) as [number, number, number]; return Date.UTC(y, m - 1, d); };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function spreadDaily(items: SpreadItem[], rule: DayRule): SpreadResult {
  const counted = dayCounter(rule);
  const days = new Map<string, number>();
  const left: SpreadLeft[] = [];
  let spread = 0, total = 0;
  for (const it of items) {
    if (it.amount === null || !Number.isFinite(it.amount) || it.amount <= 0) continue;
    total += it.amount;
    if (it.start === null || it.end === null) { left.push({ id: it.id, reason: 'no usable dates' }); continue; }
    if (it.end < it.start) { left.push({ id: it.id, reason: 'end before start' }); continue; }
    const span: string[] = [];
    for (let t = utc(it.start); t <= utc(it.end); t += DAY) if (counted(t)) span.push(iso(t));
    const where = span.length === 0 ? [it.end] : span;
    const per = it.amount / where.length;
    for (const d of where) days.set(d, (days.get(d) ?? 0) + per);
    spread += it.amount;
  }
  return { days, spread, total, left };
}

/** Cumulative amount at the end of each axis date (null after the status date). Amounts before the first axis date are included. */
export function cumulativeAt(days: Map<string, number>, axis: string[], statusDate: string): (number | null)[] {
  const keys = [...days.keys()].sort();
  let k = 0, sum = 0;
  return axis.map((d) => {
    while (k < keys.length && (keys[k] as string) <= d) { sum += days.get(keys[k] as string) as number; k += 1; }
    return d > statusDate ? null : sum;
  });
}

/**
 * What was actually spent, by item: from the actual start to the actual finish (or the status date for work not finished),
 * never later than the status date.
 */
export function actualSpendItems(
  tasks: { id: string; amount: number | null; start: string | null; finish: string | null }[],
  statusDate: string,
): { items: SpreadItem[]; left: SpreadLeft[] } {
  const items: SpreadItem[] = [];
  const left: SpreadLeft[] = [];
  for (const t of tasks) {
    if (t.amount === null || !Number.isFinite(t.amount) || t.amount <= 0) continue;
    if (t.start === null) { left.push({ id: t.id, reason: 'no actual start date' }); continue; }
    if (t.start > statusDate) { left.push({ id: t.id, reason: 'actual start is after the status date' }); continue; }
    const end = t.finish !== null && t.finish < statusDate ? t.finish : statusDate;
    items.push({ id: t.id, amount: t.amount, start: t.start, end });
  }
  return { items, left };
}

export interface MonthRow { month: string; planned: number; actual: number; plannedCum: number; actualCum: number }

/** Planned and actual amounts by calendar month (YYYY-MM), every month between the first and the last. */
export function monthly(planned: Map<string, number>, actual: Map<string, number>): MonthRow[] {
  const sum = (m: Map<string, number>) => {
    const out = new Map<string, number>();
    for (const [d, v] of m) out.set(d.slice(0, 7), (out.get(d.slice(0, 7)) ?? 0) + v);
    return out;
  };
  const p = sum(planned), a = sum(actual);
  const all = [...p.keys(), ...a.keys()].sort();
  if (all.length === 0) return [];
  const rows: MonthRow[] = [];
  let [y, m] = (all[0] as string).split('-').map(Number) as [number, number];
  const [ly, lm] = (all[all.length - 1] as string).split('-').map(Number) as [number, number];
  let pc = 0, ac = 0;
  while (y < ly || (y === ly && m <= lm)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const pv = p.get(key) ?? 0, av = a.get(key) ?? 0;
    pc += pv; ac += av;
    rows.push({ month: key, planned: pv, actual: av, plannedCum: pc, actualCum: ac });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return rows;
}
