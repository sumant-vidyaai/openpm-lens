import type { DataIssueCode, WorkItem } from './model';
import type { EvmAggregate, HoursTask } from './aggregate';
import { roundHalfUp } from './format';

/**
 * Data-quality assessment for an imported file.
 *
 * The score is simply the share of tasks that could be used in the earned-value numbers.
 * It is a transparent starting rule, not a standard: every figure behind it is shown.
 * With too few tasks the score is withheld ("Insufficient data") rather than shown.
 */
export const MIN_TASKS_FOR_SCORE = 5;

export interface FieldCompleteness {
  field: 'planned' | 'actual' | 'progress';
  label: string;
  present: number;
  total: number;
  /** 0-100, or null when there are no tasks. */
  percent: number | null;
}

export interface QualityReport {
  status: 'scored' | 'insufficient_data' | 'no_tasks';
  /** Whole number 0-100, or null when withheld. */
  score: number | null;
  usable: number;
  total: number;
  fields: FieldCompleteness[];
  /** Problems found while reading values (unparseable, ambiguous, out of range...). */
  issueCounts: { code: DataIssueCode; count: number }[];
  /** Plain-language reading of the score. */
  reading: string;
  /** How the score was worked out, in words. */
  how: string;
}

const ISSUE_LABEL: Record<DataIssueCode, string> = {
  missing_value: 'empty cell',
  unparseable: 'unreadable value',
  ambiguous_decimal: 'ambiguous number (comma or point)',
  ambiguous_date: 'ambiguous date (day/month or month/day)',
  unknown_unit: 'unrecognised unit',
  negative_value: 'negative value',
  percent_out_of_range: '% outside 0-100',
  finish_before_start: 'finish before start',
  tool_calc_disagrees: 'tool figure disagrees',
};
export const issueLabel = (code: DataIssueCode): string => ISSUE_LABEL[code];

function pct(present: number, total: number): number | null {
  return total === 0 ? null : roundHalfUp((present / total) * 100, 0);
}

export function assessQuality(
  items: WorkItem[],
  hoursTasks: HoursTask[],
  agg: EvmAggregate,
  minTasks: number = MIN_TASKS_FOR_SCORE,
): QualityReport {
  const total = items.length;
  const planned = hoursTasks.filter((t) => t.plannedHours !== null).length;
  const actual = hoursTasks.filter((t) => t.actualHours !== null).length;
  const progress = hoursTasks.filter((t) => t.percentComplete !== null).length;
  const fields: FieldCompleteness[] = [
    { field: 'planned', label: 'Planned effort', present: planned, total, percent: pct(planned, total) },
    { field: 'actual', label: 'Actual effort', present: actual, total, percent: pct(actual, total) },
    { field: 'progress', label: 'Progress (% or status)', present: progress, total, percent: pct(progress, total) },
  ];

  const counts = new Map<DataIssueCode, number>();
  for (const it of items) for (const i of it.issues) counts.set(i.code, (counts.get(i.code) ?? 0) + 1);
  const issueCounts = [...counts.entries()].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count);

  const usable = agg.counts.used;
  const how = `Score = tasks used in the earned-value numbers (${usable}) divided by all tasks (${total}). A task is used only when its planned effort, actual effort and progress are all known.`;

  if (total === 0) {
    return { status: 'no_tasks', score: null, usable, total, fields, issueCounts, reading: 'No tasks were found in the file.', how };
  }
  if (total < minTasks) {
    return {
      status: 'insufficient_data', score: null, usable, total, fields, issueCounts,
      reading: `Insufficient data: only ${total} task${total === 1 ? '' : 's'}; a score needs at least ${minTasks}.`, how,
    };
  }
  const score = roundHalfUp((usable / total) * 100, 0);
  const reading =
    score >= 80 ? 'Mostly usable' : score >= 50 ? 'Partly usable: read the totals with care' : 'Mostly unusable: most tasks are missing something';
  return {
    status: 'scored', score, usable, total, fields, issueCounts,
    reading: `${reading}. These bands are starting values, not a standard.`, how,
  };
}
