import type { EvmRow, ScheduleRow } from './explain';

export interface SubsetSums { ev: number | null; ac: number | null; bac: number | null; pv: number | null; evSchedule: number | null; costTasks: number; scheduleTasks: number }

/**
 * Headline sums for a chosen group of rows (for example one person's tasks), using the same per-task working as the whole project.
 * A sum with no usable rows is null, never 0. `rows` are positions in the file; the cost and schedule rows line up with them.
 */
export function sumSubset(evm: EvmRow[], sched: ScheduleRow[], rows: number[]): SubsetSums {
  let ev = 0, ac = 0, bac = 0, nCost = 0, pv = 0, evS = 0, nSched = 0;
  for (const i of rows) {
    const e = evm[i];
    if (e && e.used && e.ev !== null && e.ac !== null) { ev += e.ev; ac += e.ac; bac += e.plannedHours ?? 0; nCost += 1; }
    const s = sched[i];
    if (s && s.used && s.pv !== null && s.ev !== null) { pv += s.pv; evS += s.ev; nSched += 1; }
  }
  return { ev: nCost ? ev : null, ac: nCost ? ac : null, bac: nCost ? bac : null, pv: nSched ? pv : null, evSchedule: nSched ? evS : null, costTasks: nCost, scheduleTasks: nSched };
}
