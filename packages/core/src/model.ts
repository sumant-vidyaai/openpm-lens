/**
 * The canonical data model.
 *
 * Every tool's export is translated into these shapes first; formulas only ever read these.
 *
 * Rules baked into the types:
 *  1. Raw values are kept next to parsed values (see Quantity.raw).
 *  2. Missing is `null`. A blank is never turned into zero.
 *  3. Problems are recorded on the record as DataIssue entries, not silently fixed.
 *  4. Values the source tool calculated are kept in `toolCalculated` for comparison only.
 *
 * v0.1 defines the records needed for effort/cost/schedule/flow metrics. Risk, issue,
 * change request, defect, stakeholder, procurement and benefit records are planned and will
 * follow the same rules.
 */

export type Unit = 'minutes' | 'hours' | 'days' | 'weeks' | 'points';

export type DataIssueCode =
  | 'missing_value'
  | 'unparseable'
  | 'ambiguous_decimal'
  | 'unknown_unit'
  | 'negative_value'
  | 'percent_out_of_range'
  | 'finish_before_start'
  | 'tool_calc_disagrees';

export interface DataIssue {
  code: DataIssueCode;
  /** Canonical field the issue relates to, e.g. "estimate". */
  field: string;
  message: string;
}

/** A measured amount with its original text preserved. */
export interface Quantity {
  /** Exactly what the source file contained, e.g. "8.5 Hours". Null if the cell was empty. */
  raw: string | null;
  /** Parsed number, or null if missing/unparseable/ambiguous. */
  value: number | null;
  /** Parsed unit, or null if none was given or it was not recognised. */
  unit: Unit | null;
  issues: DataIssue[];
}

export type StatusCategory = 'not_started' | 'in_progress' | 'done' | 'cancelled';

export interface StatusChange {
  /** ISO 8601 timestamp. */
  at: string;
  fromStatusRaw: string | null;
  toStatusRaw: string;
  toCategory: StatusCategory | null;
}

export interface Project {
  id: string;
  sourceId: string | null;
  name: string;
  programId: string | null;
  portfolioId: string | null;
  /** Budget at completion, in the project's currency, or null if unknown. */
  budgetAtCompletion: number | null;
  currency: string | null;
  /** Free-form grouping labels used for roll-ups (team, department, location, agency...). */
  dimensions: Record<string, string>;
}

export interface WorkItem {
  id: string;
  sourceId: string | null;
  projectId: string | null;
  parentId: string | null;
  /** Source type, e.g. "Task", "Story", "Bug", "Epic", "Milestone". */
  type: string | null;
  name: string;

  statusRaw: string | null;
  statusCategory: StatusCategory | null;

  estimate: Quantity;
  remaining: Quantity;
  actual: Quantity;
  /** 0-100 as reported by the tool. Never trusted blindly; see percent-complete rules. */
  percentCompleteReported: number | null;
  storyPoints: number | null;

  /** ISO 8601 dates (YYYY-MM-DD or full timestamp). */
  start: string | null;
  due: string | null;
  finish: string | null;
  baselineStart: string | null;
  baselineFinish: string | null;
  baselineCost: number | null;
  baselineWork: Quantity;

  sprintId: string | null;
  assignee: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
  statusHistory: StatusChange[];

  /** User-defined grouping labels for roll-ups. */
  dimensions: Record<string, string>;
  /** Fields the source tool calculated (variance, "is late"...). Kept for comparison only. */
  toolCalculated: Record<string, unknown>;
  issues: DataIssue[];
}

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Dependency {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  /** Positive = lag, negative = lead. Null if the source did not say. */
  lag: Quantity;
}

export interface Resource {
  id: string;
  name: string;
  /** Available capacity per period, if known. */
  capacity: Quantity;
  costRate: number | null;
  dimensions: Record<string, string>;
}

export interface Assignment {
  workItemId: string;
  resourceId: string;
  plannedEffort: Quantity;
  actualEffort: Quantity;
}

export interface TimeEntry {
  workItemId: string | null;
  resourceId: string | null;
  /** ISO date. */
  date: string;
  effort: Quantity;
}

export interface CostEntry {
  projectId: string | null;
  workItemId: string | null;
  kind: 'budget' | 'planned' | 'actual' | 'expense' | 'commitment';
  amount: number | null;
  currency: string | null;
  /** ISO date, or null when the source gives no date. */
  date: string | null;
}

export interface Sprint {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
  committedPoints: number | null;
  completedPoints: number | null;
}
