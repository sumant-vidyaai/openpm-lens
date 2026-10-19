import type { CsvResult } from './csv';
import { aggregateHoursEvm, type MissingPlannedPolicy } from './aggregate';
import { aggregateSchedule } from './schedule';
import type { DateOrder, DayCount } from './dates';
import type { PercentRule } from './percentComplete';
import type { Unit } from './model';
import { buildWorkItems, distinctStatuses, mergeMapping, suggestStatusCategory, toHoursTasks, toScheduleTasks, type StatusMap } from './importTasks';
import { detectTableAdapter } from './tableAdapters';
import { assessQuality, type QualityReport } from './quality';

/** Settings shared by every file in a portfolio. */
export interface AnalyseSettings {
  /** Unit for plain effort numbers; null = use the tool's documented unit, else ask. */
  unitOverride: Unit | null;
  percentScale: '0-100' | '0-1';
  hoursPerDay: number;
  dateOrder: DateOrder;
  dayCount: DayCount;
  /** Holidays (ISO dates) left out of the count in weekdays mode. */
  holidays?: string[];
  /** ISO date, or '' when not chosen (schedule measures are then not worked out). */
  statusDate: string;
  missingPlanned: MissingPlannedPolicy;
  /** null = use the tool's suggested rule, else "use the % in my file". */
  ruleOverride: PercentRule | null;
  inProgressPercent: number;
}

export const DEFAULT_ANALYSE: AnalyseSettings = {
  unitOverride: null, percentScale: '0-100', hoursPerDay: 8, dateOrder: 'auto', dayCount: 'weekdays',
  statusDate: '', missingPlanned: 'exclude', ruleOverride: null, inProgressPercent: 50,
};

export interface ProjectResult {
  state: 'ok' | 'needs_unit' | 'needs_name_column';
  adapterName: string | null;
  tasks: number;
  /** Cost side (hours). */
  ev: number | null;
  ac: number | null;
  bac: number | null;
  costTasks: number;
  /** Schedule side (hours). */
  evSchedule: number | null;
  pv: number | null;
  scheduleTasks: number;
  quality: QualityReport | null;
  notes: string[];
}

const EMPTY: ProjectResult = {
  state: 'ok', adapterName: null, tasks: 0, ev: null, ac: null, bac: null, costTasks: 0,
  evSchedule: null, pv: null, scheduleTasks: 0, quality: null, notes: [],
};

/**
 * One file -> one project's numbers, using the tool's own suggestions where the file is
 * recognised. Nothing is guessed: a missing unit stops the calculation until it is chosen.
 */
export function analyseTable(table: CsvResult, s: AnalyseSettings = DEFAULT_ANALYSE): ProjectResult {
  const adapter = detectTableAdapter(table.headers);
  const suggestion = adapter ? adapter.suggest(table.headers) : null;
  const mapping = mergeMapping(table.headers, suggestion?.mapping ?? null);
  const base = { ...EMPTY, adapterName: adapter?.name ?? null, tasks: table.rows.length };
  if (mapping.name === null) {
    return { ...base, state: 'needs_name_column', notes: ['No task name column was found.'] };
  }
  const unit: Unit | null = s.unitOverride ?? (suggestion ? suggestion.defaultUnit : 'hours');
  if (unit === null) {
    return { ...base, state: 'needs_unit', notes: ['This tool does not document its effort unit. Choose one.'] };
  }
  const rule: PercentRule = s.ruleOverride ?? suggestion?.suggestedRule ?? 'tool_reported';
  const statuses = distinctStatuses(table.headers, table.rows, mapping);
  const statusMap: StatusMap = Object.fromEntries(statuses.map((x) => [x, suggestStatusCategory(x)]));
  const items = buildWorkItems(table.headers, table.rows, mapping, {
    defaultUnit: unit, percentScale: s.percentScale, statusMap, dateOrder: s.dateOrder,
  });
  const calendar = { hoursPerDay: s.hoursPerDay, daysPerWeek: 5 };
  const config = rule === 'status_based' ? { inProgressPercent: s.inProgressPercent } : undefined;
  const tasks = toHoursTasks(items, calendar, rule, config);
  const agg = aggregateHoursEvm(tasks, s.missingPlanned);
  const sched = s.statusDate ? aggregateSchedule(toScheduleTasks(items, calendar, rule, config), s.statusDate, { mode: s.dayCount, holidays: s.holidays }) : null;
  const notes = [...agg.caveats, ...(sched?.caveats ?? [])];
  if (!s.statusDate) notes.push('No status date chosen: schedule measures not worked out.');
  return {
    ...base, tasks: items.length, ev: agg.ev, ac: agg.ac, bac: agg.bac, costTasks: agg.counts.used,
    evSchedule: sched?.ev ?? null, pv: sched?.pv ?? null, scheduleTasks: sched?.counts.used ?? 0,
    quality: assessQuality(items, tasks, agg), notes,
  };
}
