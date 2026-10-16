import type { EvmRow, ScheduleRow, TemplateReadiness, TemplateSettings, CsvResult, DateOrder, DayCount, HoursTask, ScheduleTask, WorkItem } from '@openpm-lens/core';

/**
 * What the Import tab has worked out, shared with the other tabs so a file is loaded and set up once.
 * Rows of `table` line up one-to-one with `items`, `hoursTasks` and `schedTasks` (same order).
 */
export interface SharedData {
  fileName: string;
  table: CsvResult;
  items: WorkItem[];
  hoursTasks: HoursTask[];
  schedTasks: ScheduleTask[];
  statusDate: string;
  dateOrder: DateOrder;
  dayCount: DayCount;
  /** Holidays (ISO dates) left out of weekday counts, and each person's leave. */
  holidays: string[];
  leave: { person: string; from: string; to: string }[];
  hoursPerDay: number;
  /** Present when the file is the openpm-lens template: its Settings and Rates sheets (null for a CSV) and the readiness counts. */
  template: { settings: TemplateSettings | null; rates: Record<string, number>; readiness: TemplateReadiness } | null;
  /** Per-task working behind the cost and schedule numbers (same order as items). */
  evmRows: EvmRow[];
  schedRows: ScheduleRow[];
  /** Headline sums for the Overview tab (hours). Null where nothing could be used. */
  summary: { ev: number | null; ac: number | null; bac: number | null; pv: number | null; evSchedule: number | null; costTasks: number; scheduleTasks: number; tasksTotal: number };
}
