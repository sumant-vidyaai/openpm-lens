import type { ColumnMapping, ImportField } from './importTasks';
import type { Unit } from './model';
import type { PercentRule } from './percentComplete';

/**
 * Table adapters: lightweight, tool-specific knowledge for files that arrive as a table
 * (CSV or a spreadsheet). They recognise a tool's export by its column names, suggest the
 * column mapping, the unit its numbers use, and say plainly what the tool does NOT provide.
 * The user can always override every suggestion on screen.
 *
 * Column names come from each tool's public documentation where it states them, and are
 * marked as unverified in the notes where it does not. Tool names are used only to identify
 * a file format.
 */
export interface TableSuggestion {
  mapping: ColumnMapping;
  /** Unit that plain numbers in effort columns use in this tool's export, or null if unknown. */
  defaultUnit: Unit | null;
  /** Percent-complete rule that suits the tool. */
  suggestedRule: PercentRule | null;
  /** Plain-language notes shown to the user, including limits and things to verify. */
  notes: string[];
  /** Canonical fields this tool's export cannot supply (feeds the capability matrix). */
  cannotSupply: string[];
}

/** What a tool's export can supply, for the coverage matrix. */
export interface AdapterCapabilities {
  supplies: Record<ImportField, boolean>;
  /** Unit of effort numbers: a unit, or 'unknown' when the vendor does not document it. */
  effortUnit: Unit | 'unknown';
  /** True when it has a % complete the tool itself reports. */
  reportsPercent: boolean;
}

export interface TableAdapter {
  id: string;
  /** Neutral name used only to identify the file format. */
  name: string;
  detect(headers: string[]): { matches: boolean; confidence: number; reason: string };
  suggest(headers: string[]): TableSuggestion;
  capabilities: AdapterCapabilities;
}

const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');
const isSum = (h: string) => h.trim().startsWith('Σ') || h.trim().startsWith('∑');

/** First header equal (ignoring case and spacing) to any of the names, skipping sum columns. */
export function findHeader(headers: string[], names: string[]): string | null {
  for (const name of names) {
    const hit = headers.find((h) => !isSum(h) && norm(h) === name);
    if (hit) return hit;
  }
  return null;
}

interface AdapterSpec {
  id: string;
  name: string;
  /** Header groups that must all be present (each group: any one of these names). */
  required: string[][];
  /** Extra header groups that raise confidence when present. */
  bonus?: string[][];
  columns: Record<ImportField, string[]>;
  defaultUnit: Unit | null;
  suggestedRule: PercentRule | null;
  notes: string[];
  cannotSupply: string[];
  /** Notes added only when something expected is missing from this particular file. */
  extraNotes?: (mapping: ColumnMapping) => string[];
}

function makeAdapter(spec: AdapterSpec): TableAdapter {
  const has = (headers: string[], group: string[]) => findHeader(headers, group) !== null;
  return {
    id: spec.id,
    name: spec.name,
    detect(headers) {
      if (!spec.required.every((g) => has(headers, g))) {
        return { matches: false, confidence: 0, reason: 'Expected columns not found.' };
      }
      const bonus = (spec.bonus ?? []).filter((g) => has(headers, g)).length;
      const confidence = Math.min(0.95, 0.6 + 0.15 * bonus);
      return { matches: true, confidence, reason: `Found the columns typical of a ${spec.name}.` };
    },
    capabilities: {
      supplies: Object.fromEntries(
        (Object.keys(spec.columns) as ImportField[]).map((f) => [f, spec.columns[f].length > 0]),
      ) as Record<ImportField, boolean>,
      effortUnit: spec.defaultUnit ?? 'unknown',
      reportsPercent: spec.columns.percent.length > 0,
    },
    suggest(headers) {
      const mapping = Object.fromEntries(
        (Object.keys(spec.columns) as ImportField[]).map((f) => [f, findHeader(headers, spec.columns[f])]),
      ) as ColumnMapping;
      const notes = [...spec.notes, ...(spec.extraNotes ? spec.extraNotes(mapping) : [])];
      if (spec.columns.start.length === 0 || spec.columns.finish.length === 0) {
        notes.push('This tool\'s export has no planned start date, so schedule performance (SPI) cannot be worked out from it. Choose date columns in step 1 if your file has them.');
      } else {
        notes.push('Date column names are this tool\'s usual field names but are not confirmed from its documentation. Please check the start and finish choices in step 1.');
      }
      if (spec.columns.planned.length > 0 && mapping.planned === null) {
        notes.push('No planned-effort column was found, so tasks will be left out until you choose one in step 1.');
      }
      if (spec.columns.actual.length > 0 && mapping.actual === null) {
        notes.push('No actual-effort column was found, so tasks will be left out until you choose one in step 1.');
      }
      return {
        mapping, defaultUnit: spec.defaultUnit, suggestedRule: spec.suggestedRule, notes,
        cannotSupply: spec.cannotSupply,
      };
    },
  };
}

export const jiraAdapter = makeAdapter({
  id: 'jira-csv',
  name: 'Jira CSV export',
  required: [['issue key', 'key'], ['summary']],
  bonus: [['issue type'], ['issue id'], ['status category']],
  columns: {
    id: ['issue key', 'key'],
    name: ['summary'],
    status: ['status category', 'status'],
    planned: ['original estimate', 'time original estimate'],
    actual: ['time spent', 'timespent'],
    percent: [],
    start: ['start date'],
    finish: ['due date'],
  },
  defaultUnit: 'seconds',
  suggestedRule: 'zero_hundred',
  notes: [
    'Jira exports time tracking values in seconds (Atlassian documents this for Original Estimate; please confirm your Time Spent column looks the same). Plain numbers are read as seconds.',
    'Jira has no % complete field. Progress is worked out from status, so choose a status-based rule below. We start with 0/100, the most cautious.',
    'Columns starting with the sum sign (parent totals) are not used, to avoid counting sub-task time twice.',
    'Columns are matched by name. If your Jira uses other names, change the choice in step 1.',
  ],
  cannotSupply: ['percentComplete'],
});

export const azureDevOpsAdapter = makeAdapter({
  id: 'azure-devops-csv',
  name: 'Azure DevOps work item export',
  required: [['work item type'], ['title'], ['state']],
  bonus: [['id'], ['assigned to'], ['original estimate'], ['completed work']],
  columns: {
    id: ['id'],
    name: ['title'],
    status: ['state'],
    planned: ['original estimate'],
    actual: ['completed work'],
    percent: [],
    start: ['start date'],
    finish: ['finish date', 'target date', 'due date'],
  },
  defaultUnit: 'hours',
  suggestedRule: 'zero_hundred',
  notes: [
    'Microsoft documents that exports use display names such as ID, Work Item Type, Title and State.',
    'Effort fields (Original Estimate, Completed Work, Remaining Work) are normally hours, but Microsoft\'s import/export page does not state this. Please check a few values. They only appear if you added those columns to your query.',
    'Azure DevOps has no % complete on most work items. Progress comes from State, so choose a status-based rule.',
    'Completed Work is typed in by people and is often left empty. Tasks without it are left out and listed.',
    'Field names vary by process template. If your columns have other names, change them in step 1.',
  ],
  cannotSupply: ['percentComplete'],
});

export const linearAdapter = makeAdapter({
  id: 'linear-csv',
  name: 'Linear issue export',
  required: [['id'], ['title'], ['status'], ['team', 'cycle number', 'project id']],
  bonus: [['estimate'], ['started'], ['completed'], ['parent issue']],
  columns: {
    id: ['id'],
    name: ['title'],
    status: ['status'],
    planned: ['estimate'],
    actual: [],
    percent: [],
    start: [],
    finish: ['due date'],
  },
  defaultUnit: 'points',
  suggestedRule: 'zero_hundred',
  notes: [
    'Linear\'s export has no time-spent or hours column (checked against Linear\'s export documentation).',
    'Its Estimate column is in points (or the scale your team chose), not hours. So hour-based cost results such as CPI and CV cannot be calculated from this file, and the results below will say what is missing.',
    'The Started, Completed and Created dates are present. Flow metrics such as cycle time will use them in a later version.',
  ],
  cannotSupply: ['actualEffort', 'percentComplete'],
});

export const clickUpAdapter = makeAdapter({
  id: 'clickup-csv',
  name: 'ClickUp task export',
  required: [['task id'], ['task name'], ['status']],
  bonus: [['time estimated'], ['time spent'], ['date created']],
  columns: {
    id: ['task id'],
    name: ['task name'],
    status: ['status'],
    planned: ['time estimated'],
    actual: ['time spent'],
    percent: [],
    start: ['start date'],
    finish: ['due date'],
  },
  defaultUnit: null,
  suggestedRule: 'zero_hundred',
  notes: [
    'ClickUp lists Time Estimated and Time Spent in its export, each with a "Text" companion column. Its documentation does not say what unit the plain columns use.',
    'Please look at a few values and choose the unit in step 2. The unit is not guessed.',
    'ClickUp has no % complete on tasks. Progress comes from Status, so choose a status-based rule.',
  ],
  cannotSupply: ['percentComplete'],
});

export const workfrontAdapter = makeAdapter({
  id: 'workfront-export',
  name: 'Workfront task report export',
  required: [['planned hours'], ['actual hours', 'percent complete']],
  bonus: [['percent complete'], ['status'], ['name', 'task name']],
  columns: {
    id: ['id', 'task id'],
    name: ['name', 'task name'],
    status: ['status'],
    planned: ['planned hours'],
    actual: ['actual hours'],
    percent: ['percent complete', '% complete'],
    start: ['planned start date'],
    finish: ['planned completion date'],
  },
  defaultUnit: 'hours',
  suggestedRule: 'tool_reported',
  notes: [
    'Report columns in Workfront are chosen by whoever built the view, so names can differ. Please check the choices in step 1.',
    'Adobe documents that Planned Hours is stored in minutes in the database, and Actual Hours in hours. A report column labelled in hours should already be converted, but please check a few values before trusting the results.',
    'Workfront reports a % complete, but it is the tool\'s own figure. You can switch to a status-based rule if you do not trust it.',
  ],
  cannotSupply: [],
});

export const msProjectAdapter = makeAdapter({
  id: 'ms-project-table',
  name: 'Microsoft Project table export',
  required: [['name', 'task name'], ['work'], ['actual work', 'baseline work', '% complete'], ['start', 'finish']],
  bonus: [['actual work'], ['baseline work'], ['% complete'], ['duration']],
  columns: {
    id: ['id', 'wbs'],
    name: ['name', 'task name'],
    status: [],
    planned: ['baseline work', 'work'],
    actual: ['actual work'],
    percent: ['% complete', 'percent complete'],
    start: ['baseline start', 'start'],
    finish: ['baseline finish', 'finish'],
  },
  defaultUnit: 'hours',
  suggestedRule: 'tool_reported',
  notes: [
    'Project writes effort with its unit in the cell (for example "40 hrs" or "5 days"), and the app reads that unit. If a day in your plan is not 8 hours, set the hours per day in step 2.',
    'Planned effort uses Baseline Work when the column is present, and Work otherwise. Baseline Work is the better choice for earned value because it does not move as the plan is updated.',
    'These column names are Project\'s standard field names, but I could not confirm them against Microsoft\'s documentation. Please check step 1.',
    'Numbers with a thousands comma, such as "1,200 hrs", are not read, because the comma can mean different things in different regions. They are flagged and the task is left out. Remove the comma in the file if that applies.',
    'This reads a table exported to Excel or CSV. The XML (MSPDI) file format is not supported yet.',
  ],
  cannotSupply: [],
  extraNotes: (m) =>
    m.planned !== null && norm(m.planned) === 'work'
      ? ['No Baseline Work column found. Using Work, which changes whenever the plan is edited, so earned value will be less reliable.']
      : [],
});

export const TABLE_ADAPTERS: TableAdapter[] = [
  jiraAdapter, azureDevOpsAdapter, linearAdapter, clickUpAdapter, workfrontAdapter, msProjectAdapter,
];

/** The best-matching adapter for these headers, or null for a generic file. */
export function detectTableAdapter(headers: string[]): TableAdapter | null {
  let best: { adapter: TableAdapter; confidence: number } | null = null;
  for (const adapter of TABLE_ADAPTERS) {
    const d = adapter.detect(headers);
    if (d.matches && (best === null || d.confidence > best.confidence)) best = { adapter, confidence: d.confidence };
  }
  return best?.adapter ?? null;
}

export type CoverageCell = 'yes' | 'no' | 'check';

export interface CoverageRow {
  label: string;
  /** One cell per adapter, in TABLE_ADAPTERS order. */
  cells: CoverageCell[];
  note?: string;
}

/**
 * The tool-coverage matrix: which tools can supply which inputs, and which metrics that allows.
 * "check" means the export has the column but the vendor does not document its unit.
 */
export function coverageMatrix(adapters: TableAdapter[] = TABLE_ADAPTERS): CoverageRow[] {
  const field = (f: ImportField, label: string): CoverageRow => ({
    label,
    cells: adapters.map((a) => (a.capabilities.supplies[f] ? 'yes' : 'no')),
  });
  const effort = (f: 'planned' | 'actual', label: string): CoverageRow => ({
    label,
    cells: adapters.map((a) =>
      !a.capabilities.supplies[f] ? 'no' : a.capabilities.effortUnit === 'unknown' ? 'check' : 'yes',
    ),
    note: 'Check = the column exists but the tool\'s documentation does not state its unit.',
  });
  const canCost = (a: TableAdapter) => {
    const c = a.capabilities;
    return c.supplies.planned && c.supplies.actual && (c.reportsPercent || c.supplies.status) && c.effortUnit !== 'points';
  };
  return [
    field('name', 'Task name'),
    field('status', 'Status'),
    effort('planned', 'Planned effort in a time unit'),
    effort('actual', 'Actual effort in a time unit'),
    field('percent', 'Reports its own % complete'),
    {
      label: 'Earned value, CPI and cost variance',
      cells: adapters.map((a) => (!canCost(a) ? 'no' : a.capabilities.effortUnit === 'unknown' ? 'check' : 'yes')),
      note: 'Needs planned effort, actual effort and some measure of progress.',
    },
    {
      label: 'Planned start and finish dates',
      cells: adapters.map((a) => (a.capabilities.supplies.start && a.capabilities.supplies.finish ? 'check' : 'no')),
      note: 'Check = the export is expected to have date columns, but the tool\'s documentation does not confirm their names.',
    },
    {
      label: 'Schedule performance (SPI) and schedule variance',
      cells: adapters.map((a) => {
        const c = a.capabilities;
        const ok = c.supplies.planned && c.supplies.start && c.supplies.finish && (c.reportsPercent || c.supplies.status) && c.effortUnit !== 'points';
        return ok ? 'check' : 'no';
      }),
      note: 'Needs planned effort, planned start and finish dates, and some measure of progress. Does not need actual effort.',
    },
  ];
}
