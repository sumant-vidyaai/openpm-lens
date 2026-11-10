import type { MetricStatus } from './result';

/**
 * Aggregate task-level hours into project-level EV, AC and BAC (hours as the cost unit),
 * applying the approved missing-data rules visibly.
 *
 * Rules:
 *  - A task with no actual hours, or no percent complete, is excluded. We never guess them.
 *  - A task with no planned hours is handled by the explicit `missingPlanned` policy:
 *      'exclude'       (default) leave the task out of EV, AC and BAC, and say so.
 *      'treat_as_zero' count planned hours as 0 (its actual hours still count as cost),
 *                      and flag the assumption. Useful as a worst-case view.
 */

export interface HoursTask {
  id: string;
  plannedHours: number | null;
  actualHours: number | null;
  /** 0-100, already determined by the chosen percent-complete rule. */
  percentComplete: number | null;
}

export type MissingPlannedPolicy = 'exclude' | 'treat_as_zero';

export interface ExcludedTask {
  id: string;
  reason: 'no planned hours' | 'no actual hours' | 'no % complete';
}

export interface EvmAggregate {
  status: MetricStatus;
  /** Earned value in hours, or null if no task could be used. */
  ev: number | null;
  /** Actual cost in hours, or null if no task could be used. */
  ac: number | null;
  /** Budget at completion in hours (sum of planned hours of tasks used), or null. */
  bac: number | null;
  counts: { total: number; used: number; excluded: number; assumedZeroPlanned: number };
  excluded: ExcludedTask[];
  caveats: string[];
  missing: string[];
}

function isNumber(n: number | null): n is number {
  return n !== null && Number.isFinite(n);
}

export function aggregateHoursEvm(
  tasks: HoursTask[],
  missingPlanned: MissingPlannedPolicy = 'exclude',
): EvmAggregate {
  let ev = 0;
  let ac = 0;
  let bac = 0;
  let used = 0;
  let assumedZeroPlanned = 0;
  const excluded: ExcludedTask[] = [];

  for (const task of tasks) {
    if (!isNumber(task.actualHours)) {
      excluded.push({ id: task.id, reason: 'no actual hours' });
      continue;
    }
    if (!isNumber(task.percentComplete)) {
      excluded.push({ id: task.id, reason: 'no % complete' });
      continue;
    }
    let planned: number;
    if (isNumber(task.plannedHours)) {
      planned = task.plannedHours;
    } else if (missingPlanned === 'treat_as_zero') {
      planned = 0;
      assumedZeroPlanned += 1;
    } else {
      excluded.push({ id: task.id, reason: 'no planned hours' });
      continue;
    }
    ev += planned * (task.percentComplete / 100);
    ac += task.actualHours;
    bac += planned;
    used += 1;
  }

  const total = tasks.length;
  const counts = { total, used, excluded: excluded.length, assumedZeroPlanned };
  const caveats: string[] = [];

  if (excluded.length > 0) {
    const byReason = new Map<string, number>();
    for (const e of excluded) byReason.set(e.reason, (byReason.get(e.reason) ?? 0) + 1);
    const detail =
      byReason.size === 1
        ? [...byReason.keys()][0]
        : [...byReason.entries()].map(([reason, n]) => `${n} ${reason}`).join('; ');
    caveats.push(`${excluded.length} of ${total} tasks excluded (${detail}).`);
  }
  if (assumedZeroPlanned > 0) {
    caveats.push(
      `Assumption: planned hours treated as 0 for ${assumedZeroPlanned} of ${total} tasks with none recorded.`,
    );
  }

  if (used === 0) {
    const missing = new Set<string>();
    for (const e of excluded) {
      missing.add(
        e.reason === 'no planned hours'
          ? 'plannedHours'
          : e.reason === 'no actual hours'
            ? 'actualHours'
            : 'percentComplete',
      );
    }
    if (total === 0) missing.add('tasks');
    return {
      status: 'not_available',
      ev: null,
      ac: null,
      bac: null,
      counts,
      excluded,
      caveats,
      missing: [...missing],
    };
  }

  return {
    status: caveats.length > 0 ? 'computed_with_caveats' : 'computed',
    ev,
    ac,
    bac,
    counts,
    excluded,
    caveats,
    missing: [],
  };
}
