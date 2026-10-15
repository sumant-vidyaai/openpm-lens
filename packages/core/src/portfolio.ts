import type { ProjectResult } from './analyse';
import { assessHealth, DEFAULT_THRESHOLDS, type HealthResult, type HealthThresholds } from './health';
import { costVariance, scheduleVariance } from './evm';

/**
 * Portfolio roll-ups.
 *
 * Rule: add up the underlying hours first, then work out the ratios from the totals.
 * Ratios are never averaged (an average of CPIs is not the CPI of the sum).
 * Projects with no usable number for a figure are left out of that figure and counted.
 */
export interface PortfolioProject {
  id: string;
  name: string;
  programme: string;
  team: string;
  result: ProjectResult;
}

export type RollupBy = 'project' | 'programme' | 'team' | 'all';

export interface RollupRow {
  key: string;
  label: string;
  projects: number;
  tasks: number;
  ev: number | null;
  ac: number | null;
  cv: number | null;
  evSchedule: number | null;
  pv: number | null;
  sv: number | null;
  costTasks: number;
  scheduleTasks: number;
  health: HealthResult;
  /** Projects left out of cost figures / schedule figures because they had no usable number. */
  leftOutCost: number;
  leftOutSchedule: number;
  /** Projects that could not be worked out at all (unit or name column missing). */
  notReady: number;
}

export const NO_PROGRAMME = '(no programme)';
export const NO_TEAM = '(no team)';
export const ALL_PROJECTS = 'All projects';

function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
}

export function rollupGroup(
  key: string, label: string, group: PortfolioProject[], t: HealthThresholds = DEFAULT_THRESHOLDS,
): RollupRow {
  const ready = group.filter((p) => p.result.state === 'ok');
  const costOk = ready.filter((p) => p.result.ev !== null && p.result.ac !== null);
  const schedOk = ready.filter((p) => p.result.evSchedule !== null && p.result.pv !== null);
  const ev = sumOrNull(costOk.map((p) => p.result.ev));
  const ac = sumOrNull(costOk.map((p) => p.result.ac));
  const evSchedule = sumOrNull(schedOk.map((p) => p.result.evSchedule));
  const pv = sumOrNull(schedOk.map((p) => p.result.pv));
  const costTasks = costOk.reduce((n, p) => n + p.result.costTasks, 0);
  const scheduleTasks = schedOk.reduce((n, p) => n + p.result.scheduleTasks, 0);
  return {
    key, label, projects: group.length, tasks: group.reduce((n, p) => n + p.result.tasks, 0),
    ev, ac, cv: ev !== null && ac !== null ? costVariance(ev, ac) : null,
    evSchedule, pv, sv: evSchedule !== null && pv !== null ? scheduleVariance(evSchedule, pv) : null,
    costTasks, scheduleTasks,
    health: assessHealth({ ev, ac, costTasks, evSchedule, pv, scheduleTasks }, t),
    leftOutCost: ready.length - costOk.length,
    leftOutSchedule: ready.length - schedOk.length,
    notReady: group.length - ready.length,
  };
}

export function rollup(
  projects: PortfolioProject[], by: RollupBy, t: HealthThresholds = DEFAULT_THRESHOLDS,
): RollupRow[] {
  if (by === 'all') return [rollupGroup('all', ALL_PROJECTS, projects, t)];
  if (by === 'project') return projects.map((p) => rollupGroup(p.id, p.name, [p], t));
  const groups = new Map<string, PortfolioProject[]>();
  for (const p of projects) {
    const raw = (by === 'programme' ? p.programme : p.team).trim();
    const label = raw === '' ? (by === 'programme' ? NO_PROGRAMME : NO_TEAM) : raw;
    groups.set(label, [...(groups.get(label) ?? []), p]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, g]) => rollupGroup(label, label, g, t));
}
