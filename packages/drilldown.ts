import type { EvmRow, ScheduleRow } from './explain';

/**
 * "Why is it red?": which tasks pull cost and schedule down, and which data gaps leave tasks out.
 * Plain arithmetic on the per-task rows already shown in "show the working", so the lists add up to the headline.
 *
 * Cost: a task's cost variance = its earned value - its actual hours. Schedule: a task's schedule variance =
 * its earned value - its planned value. Negative = behind (or over). A task's share is its part of the total shortfall,
 * where the shortfall is the sum of all negative variances (positive ones are shown separately, never netted away).
 */
export interface Contributor {
  /** Position in the task list (same order as the rows). */
  index: number;
  id: string;
  /** Variance in hours (negative = hurts). */
  variance: number;
  /** Part (0-1) of the total shortfall. */
  share: number;
}
export interface Contributors {
  items: Contributor[];
  /** Sum of all negative variances, as a positive number of hours. */
  shortfall: number;
  /** Sum of all positive variances. */
  surplus: number;
  /** Net variance = surplus - shortfall (equals EV - AC, or EV - PV, over the tasks used). */
  net: number;
  /** Number of tasks with a negative variance. */
  negativeTasks: number;
  /** Negative-variance tasks not listed because of the limit. */
  notShown: number;
}

function rank(vars: { index: number; id: string; v: number }[], limit: number): Contributors {
  const neg = vars.filter((x) => x.v < -1e-12);
  const shortfall = neg.reduce((a, x) => a - x.v, 0);
  const surplus = vars.filter((x) => x.v > 1e-12).reduce((a, x) => a + x.v, 0);
  const sorted = [...neg].sort((a, b) => a.v - b.v || a.index - b.index);
  const items = sorted.slice(0, limit).map((x) => ({ index: x.index, id: x.id, variance: x.v, share: shortfall > 0 ? -x.v / shortfall : 0 }));
  return { items, shortfall, surplus, net: surplus - shortfall, negativeTasks: neg.length, notShown: Math.max(0, neg.length - limit) };
}

export function costContributors(rows: EvmRow[], limit = 5): Contributors {
  const vars: { index: number; id: string; v: number }[] = [];
  rows.forEach((r, index) => { if (r.used && r.ev !== null && r.ac !== null) vars.push({ index, id: r.id, v: r.ev - r.ac }); });
  return rank(vars, limit);
}

export function scheduleContributors(rows: ScheduleRow[], limit = 5): Contributors {
  const vars: { index: number; id: string; v: number }[] = [];
  rows.forEach((r, index) => { if (r.used && r.ev !== null && r.pv !== null) vars.push({ index, id: r.id, v: r.ev - r.pv }); });
  return rank(vars, limit);
}

export interface FixGroup {
  area: 'Cost' | 'Schedule';
  /** What is missing, in plain words. */
  reason: string;
  count: number;
  /** Up to five task ids as examples. */
  ids: string[];
}

/**
 * Groups the tasks left out of cost and schedule measures by what is missing, biggest group first.
 * Cancelled tasks are left out on purpose and are not listed as something to fix.
 */
export function fixFirst(evm: EvmRow[], sched: ScheduleRow[], cancelled: boolean[]): { groups: FixGroup[]; cancelledCount: number } {
  const groups = new Map<string, FixGroup>();
  const add = (area: FixGroup['area'], note: string, id: string) => {
    const reason = note.replace(/^Left out: /, '').replace(/ \(missing or unclear.*$/, ' (missing or unclear)');
    const k = `${area}|${reason}`;
    const g = groups.get(k) ?? { area, reason, count: 0, ids: [] };
    g.count += 1;
    if (g.ids.length < 5) g.ids.push(id);
    groups.set(k, g);
  };
  evm.forEach((r, i) => { if (!r.used && !cancelled[i]) add('Cost', r.note, r.id); });
  sched.forEach((r, i) => { if (!r.used && !cancelled[i]) add('Schedule', r.note, r.id); });
  return { groups: [...groups.values()].sort((a, b) => b.count - a.count || a.area.localeCompare(b.area)), cancelledCount: cancelled.filter(Boolean).length };
}
