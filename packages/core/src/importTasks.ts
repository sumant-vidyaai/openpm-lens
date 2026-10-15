import type { DataIssue, StatusCategory, Unit, WorkItem } from './model';
import { parseQuantity, convertToHours, type WorkCalendar } from './units';
import { percentComplete, type PercentRule, type StatusBasedConfig } from './percentComplete';
import type { HoursTask } from './aggregate';

/** Fields a file column can be mapped to. */
export type ImportField = 'id' | 'name' | 'status' | 'planned' | 'actual' | 'percent';

export const IMPORT_FIELDS: { field: ImportField; label: string; required: boolean }[] = [
  { field: 'name', label: 'Task name', required: true },
  { field: 'planned', label: 'Planned effort (estimate)', required: false },
  { field: 'actual', label: 'Actual effort (time spent)', required: false },
  { field: 'percent', label: '% complete', required: false },
  { field: 'status', label: 'Status', required: false },
  { field: 'id', label: 'Task ID', required: false },
];

/** Column header (exact text) chosen for each field, or null for "not in my file". */
export type ColumnMapping = Record<ImportField, string | null>;

const HINTS: Record<ImportField, RegExp[]> = {
  id: [/^(task |issue |item )?(id|key|number|no\.?)$/i, /^wbs$/i],
  name: [/^(task |issue |item |work item )?(name|title|summary)$/i, /^task$/i],
  status: [/status|state/i],
  planned: [/planned|estimate|original|baseline work|budget(ed)? (hours|work)/i],
  actual: [/actual|time ?spent|logged|worked/i],
  percent: [/(%|percent|pct).*(complete|done)|complete.*(%|percent)|progress/i],
};

/** Suggests a column for each field from header wording. The user can always change it. */
export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { id: null, name: null, status: null, planned: null, actual: null, percent: null };
  const taken = new Set<string>();
  for (const field of ['name', 'planned', 'actual', 'percent', 'status', 'id'] as ImportField[]) {
    for (const re of HINTS[field]) {
      const hit = headers.find((h) => !taken.has(h) && re.test(h));
      if (hit) {
        mapping[field] = hit;
        taken.add(hit);
        break;
      }
    }
  }
  return mapping;
}

export type StatusMap = Record<string, StatusCategory | 'unmapped'>;

/** First guess at what a status word means. Anything unrecognised is left for the user. */
export function suggestStatusCategory(raw: string): StatusCategory | 'unmapped' {
  const s = raw.trim().toLowerCase();
  if (s === '') return 'unmapped';
  if (/cancel|abandon|won'?t|reject|obsolete/.test(s)) return 'cancelled';
  if (/^(done|closed|complete|completed|resolved|finished|released|delivered)$/.test(s)) return 'done';
  if (/not started|to ?do|open|new|backlog|planned|proposed|ready|unstarted/.test(s)) return 'not_started';
  if (/progress|doing|active|review|testing|started|blocked|development/.test(s)) return 'in_progress';
  return 'unmapped';
}

export function distinctStatuses(headers: string[], rows: string[][], mapping: ColumnMapping): string[] {
  const col = mapping.status === null ? -1 : headers.indexOf(mapping.status);
  if (col < 0) return [];
  return [...new Set(rows.map((r) => (r[col] ?? '').trim()).filter((v) => v !== ''))].sort();
}

export interface ImportOptions {
  /** Unit assumed when an effort cell has a number but no unit. Must be chosen by the user. */
  defaultUnit: Unit;
  /** Whether a percent column holds 0-100 (default) or 0-1. */
  percentScale: '0-100' | '0-1';
  statusMap: StatusMap;
}

function emptyItem(id: string, name: string): WorkItem {
  const q = { raw: null, value: null, unit: null, issues: [] };
  return {
    id, sourceId: id, projectId: null, parentId: null, type: null, name,
    statusRaw: null, statusCategory: null,
    estimate: { ...q }, remaining: { ...q }, actual: { ...q },
    percentCompleteReported: null, storyPoints: null,
    start: null, due: null, finish: null, baselineStart: null, baselineFinish: null,
    baselineCost: null, baselineWork: { ...q },
    sprintId: null, assignee: null, createdAt: null, resolvedAt: null, statusHistory: [],
    dimensions: {}, toolCalculated: {}, issues: [],
  };
}

function parsePercent(text: string, scale: '0-100' | '0-1', field: string): { value: number | null; issues: DataIssue[] } {
  const s = text.trim();
  if (s === '') return { value: null, issues: [] };
  const hasSign = s.endsWith('%');
  const q = parseQuantity(hasSign ? s.slice(0, -1) : s, { field });
  if (q.value === null) return { value: null, issues: q.issues };
  const value = !hasSign && scale === '0-1' ? q.value * 100 : q.value;
  if (value < 0 || value > 100) {
    return {
      value: null,
      issues: [{ code: 'percent_out_of_range', field, message: `"${s}" is outside 0-100%; not used.` }],
    };
  }
  return { value, issues: [] };
}

/** Turns file rows into canonical work items, recording every problem on the item. */
export function buildWorkItems(
  headers: string[],
  rows: string[][],
  mapping: ColumnMapping,
  options: ImportOptions,
): WorkItem[] {
  const idx = (f: ImportField) => (mapping[f] === null ? -1 : headers.indexOf(mapping[f] as string));
  const cell = (r: string[], i: number) => (i < 0 ? '' : (r[i] ?? '').trim());
  const [iId, iName, iStatus, iPlan, iAct, iPct] = (['id', 'name', 'status', 'planned', 'actual', 'percent'] as ImportField[]).map(idx) as [number, number, number, number, number, number];

  return rows.map((r, n) => {
    const name = cell(r, iName) || `(row ${n + 2} has no name)`;
    const item = emptyItem(cell(r, iId) || `row-${n + 2}`, name);
    if (cell(r, iPlan) !== '') item.estimate = parseQuantity(cell(r, iPlan), { defaultUnit: options.defaultUnit, field: 'estimate' });
    if (cell(r, iAct) !== '') item.actual = parseQuantity(cell(r, iAct), { defaultUnit: options.defaultUnit, field: 'actual' });
    if (iPct >= 0) {
      const p = parsePercent(cell(r, iPct), options.percentScale, 'percentComplete');
      item.percentCompleteReported = p.value;
      item.issues.push(...p.issues);
    }
    const rawStatus = cell(r, iStatus);
    if (rawStatus !== '') {
      item.statusRaw = rawStatus;
      const mapped = options.statusMap[rawStatus];
      item.statusCategory = mapped === undefined || mapped === 'unmapped' ? null : mapped;
    }
    item.issues.push(...item.estimate.issues, ...item.actual.issues);
    return item;
  });
}

/** Applies the chosen percent-complete rule and work calendar to produce EVM inputs in hours. */
export function toHoursTasks(
  items: WorkItem[],
  calendar: WorkCalendar,
  rule: PercentRule,
  config?: StatusBasedConfig,
): HoursTask[] {
  return items.map((it) => {
    const pct = percentComplete(rule, { reportedPercent: it.percentCompleteReported, statusCategory: it.statusCategory }, config);
    return {
      id: it.id,
      plannedHours: convertToHours(it.estimate, calendar),
      actualHours: convertToHours(it.actual, calendar),
      percentComplete: pct.value,
    };
  });
}
