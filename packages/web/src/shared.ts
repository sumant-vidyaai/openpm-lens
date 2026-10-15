import type { CsvResult, DateOrder, DayCount, HoursTask, ScheduleTask, WorkItem } from '@openpm-lens/core';

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
  hoursPerDay: number;
}
