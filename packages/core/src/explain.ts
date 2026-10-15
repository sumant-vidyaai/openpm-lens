import type { EvmAggregate, HoursTask, MissingPlannedPolicy } from './aggregate';
import type { ScheduleAggregate, ScheduleTask } from './schedule';
import { plannedFraction } from './schedule';
import type { DayCount } from './dates';
import { roundHalfUp } from './format';

/**
 * "Show the working": per-task rows and formula steps that explain a result.
 *
 * Rows repeat the aggregation rules task by task. A test checks that the rows add up to the
 * headline numbers, so the explanation cannot drift away from the calculation.
 */

const fin = (n: number | null): n is number => n !== null && Number.isFinite(n);
const num = (n: number | null, d = 2) => (n === null ? 'not available' : String(roundHalfUp(n, d)));

export interface EvmRow {
  id: string;
  plannedHours: number | null;
  actualHours: number | null;
  percentComplete: number | null;
  /** Earned value this task adds, or null if the task was left out. */
  ev: number | null;
  /** Actual cost this task adds, or null if the task was left out. */
  ac: number | null;
  used: boolean;
  note: string;
}

export function explainEvmRows(tasks: HoursTask[], missingPlanned: MissingPlannedPolicy = 'exclude'): EvmRow[] {
  return tasks.map((t) => {
    const base = { id: t.id, plannedHours: t.plannedHours, actualHours: t.actualHours, percentComplete: t.percentComplete };
    if (!fin(t.actualHours)) return { ...base, ev: null, ac: null, used: false, note: 'Left out: no actual hours' };
    if (!fin(t.percentComplete)) return { ...base, ev: null, ac: null, used: false, note: 'Left out: no % complete' };
    let planned: number;
    let note = 'Used';
    if (fin(t.plannedHours)) planned = t.plannedHours;
    else if (missingPlanned === 'treat_as_zero') {
      planned = 0;
      note = 'Used, with planned hours assumed to be 0';
    } else return { ...base, ev: null, ac: null, used: false, note: 'Left out: no planned hours' };
    return { ...base, ev: planned * (t.percentComplete / 100), ac: t.actualHours, used: true, note };
  });
}

export interface ScheduleRow {
  id: string;
  plannedHours: number | null;
  plannedStart: string | null;
  plannedFinish: string | null;
  percentComplete: number | null;
  /** Share (0-1) of the task planned to be done by the status date. */
  plannedShare: number | null;
  pv: number | null;
  ev: number | null;
  used: boolean;
  note: string;
}

export function explainScheduleRows(tasks: ScheduleTask[], statusDate: string, mode: DayCount): ScheduleRow[] {
  return tasks.map((t) => {
    const base = {
      id: t.id, plannedHours: t.plannedHours, plannedStart: t.plannedStart, plannedFinish: t.plannedFinish,
      percentComplete: t.percentComplete, plannedShare: null, pv: null, ev: null, used: false,
    };
    if (!fin(t.plannedHours)) return { ...base, note: 'Left out: no planned hours' };
    if (!fin(t.percentComplete)) return { ...base, note: 'Left out: no % complete' };
    if (t.plannedStart === null || t.plannedFinish === null) return { ...base, note: 'Left out: no planned dates' };
    if (t.plannedFinish < t.plannedStart) return { ...base, note: 'Left out: finish before start' };
    const share = plannedFraction(t.plannedStart, t.plannedFinish, statusDate, mode);
    return {
      ...base, plannedShare: share, pv: t.plannedHours * share, ev: t.plannedHours * (t.percentComplete / 100),
      used: true, note: 'Used',
    };
  });
}

export interface StepGroup {
  label: string;
  steps: string[];
}

/** Formula walk-through for EV, AC, CPI and CV, using the actual numbers. */
export function evmSteps(agg: EvmAggregate): StepGroup[] {
  if (agg.ev === null || agg.ac === null) return [];
  const { ev, ac } = agg;
  const groups: StepGroup[] = [
    { label: 'Earned value (EV)', steps: ['EV = sum of (planned hours x % complete) over the tasks used', `EV = ${num(ev)} hours`] },
    { label: 'Actual cost (AC)', steps: ['AC = sum of actual hours over the tasks used', `AC = ${num(ac)} hours`] },
  ];
  if (ac !== 0) {
    const cpi = ev / ac;
    groups.push({
      label: 'Cost performance index (CPI)',
      steps: ['CPI = EV / AC', `CPI = ${num(ev)} / ${num(ac)}`, `CPI = ${num(cpi, 4)}, shown as ${num(cpi)} (calculations keep the unrounded value)`],
    });
  } else {
    groups.push({ label: 'Cost performance index (CPI)', steps: ['CPI = EV / AC', 'AC is 0, so CPI is not available (dividing by zero would be meaningless)'] });
  }
  groups.push({ label: 'Cost variance (CV)', steps: ['CV = EV - AC', `CV = ${num(ev)} - ${num(ac)}`, `CV = ${num(ev - ac)} hours`] });
  return groups;
}

/** Formula walk-through for PV, EV, SPI and SV. */
export function scheduleSteps(agg: ScheduleAggregate, statusDate: string, mode: DayCount): StepGroup[] {
  if (agg.pv === null || agg.ev === null) return [];
  const { pv, ev } = agg;
  const groups: StepGroup[] = [
    {
      label: 'Planned value (PV)',
      steps: [
        `PV = sum of (planned hours x share of its planned ${mode === 'weekdays' ? 'weekdays' : 'calendar days'} elapsed by ${statusDate})`,
        `PV = ${num(pv)} hours`,
      ],
    },
    { label: 'Earned value (EV)', steps: ['EV = sum of (planned hours x % complete) over the same tasks', `EV = ${num(ev)} hours`] },
  ];
  if (pv !== 0) {
    const spi = ev / pv;
    groups.push({
      label: 'Schedule performance index (SPI)',
      steps: ['SPI = EV / PV', `SPI = ${num(ev)} / ${num(pv)}`, `SPI = ${num(spi, 4)}, shown as ${num(spi)}`],
    });
  } else {
    groups.push({ label: 'Schedule performance index (SPI)', steps: ['SPI = EV / PV', 'PV is 0 (nothing was planned by this date), so SPI is not available'] });
  }
  groups.push({ label: 'Schedule variance (SV)', steps: ['SV = EV - PV', `SV = ${num(ev)} - ${num(pv)}`, `SV = ${num(ev - pv)} hours`] });
  return groups;
}
