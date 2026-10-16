import type { GridCell } from './csv';
import type { DayCount } from './dates';
import type { PercentRule } from './percentComplete';
import { parseDateText } from './dates';
import { suggestStatusCategory } from './importTasks';

/**
 * The openpm-lens fill-in template. Its column names are fixed so the app can recognise a
 * filled template and set itself up with no mapping questions. Nothing here is a standard:
 * it is just our agreed layout, explained on the "Start here" sheet of the workbook.
 */
export const TEMPLATE_COLUMNS = [
  'Project', 'Programme', 'Team', 'ID', 'Task', 'Type', 'Status', 'Assignee',
  'Planned start', 'Planned finish', 'Actual start', 'Actual finish',
  'Estimate (h)', 'Actual (h)', '% complete', 'Created', 'Severity', 'Found in',
] as const;
export type TemplateColumn = (typeof TEMPLATE_COLUMNS)[number];

export const TEMPLATE_STATUSES = ['Not started', 'In progress', 'Done', 'Cancelled'] as const;
export const TEMPLATE_TYPES = ['Task', 'Bug', 'Story', 'Milestone', 'Risk', 'Change'] as const;

/** Column names that are enough to call a file "our template" (the rest are optional). */
const REQUIRED_FOR_DETECTION: TemplateColumn[] = ['Task', 'Status', 'Estimate (h)', 'Actual (h)', '% complete', 'Planned start', 'Actual start'];

export function isTemplateTable(headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.trim()));
  return REQUIRED_FOR_DETECTION.every((c) => set.has(c));
}

export const SETTING_LABELS = {
  statusDate: 'Status date',
  hoursPerDay: 'Hours per working day',
  dayCount: 'Days counted',
  capacity: 'Weekly capacity (h)',
  currency: 'Currency',
  defaultRate: 'Default hourly rate',
  greenMin: 'Green from',
  amberMin: 'Amber from',
  rule: 'Progress rule',
  inProgressPercent: 'In-progress credit (%)',
} as const;

export const RULE_CHOICES: { label: string; rule: PercentRule }[] = [
  { label: 'Use the % complete column', rule: 'tool_reported' },
  { label: '0/100', rule: 'zero_hundred' },
  { label: '50/50', rule: 'fifty_fifty' },
  { label: 'Status-based', rule: 'status_based' },
];
export const DAY_CHOICES: { label: string; value: DayCount }[] = [
  { label: 'Weekdays', value: 'weekdays' },
  { label: 'All days', value: 'calendar' },
];

export interface TemplateSettings {
  statusDate: string | null;
  hoursPerDay: number | null;
  dayCount: DayCount | null;
  capacity: number | null;
  currency: string | null;
  defaultRate: number | null;
  greenMin: number | null;
  amberMin: number | null;
  rule: PercentRule | null;
  inProgressPercent: number | null;
  /** Things in the Settings sheet that were not understood (shown to the user, never guessed). */
  problems: string[];
}

export interface TemplateRates {
  rates: Record<string, number>;
  problems: string[];
}

const txt = (c: GridCell): string => {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return Number.isNaN(c.getTime()) ? '' : c.toISOString().slice(0, 10);
  return String(c).trim();
};
const num = (c: GridCell): number | null => {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  const t = txt(c);
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

/** Reads the Settings sheet (label in column A, value in column B). Blank or odd values stay null. */
export function parseTemplateSettings(grid: GridCell[][]): TemplateSettings {
  const s: TemplateSettings = {
    statusDate: null, hoursPerDay: null, dayCount: null, capacity: null, currency: null,
    defaultRate: null, greenMin: null, amberMin: null, rule: null, inProgressPercent: null, problems: [],
  };
  const byLabel = new Map<string, GridCell>();
  for (const r of grid) {
    const k = txt(r[0]).toLowerCase();
    if (k) byLabel.set(k, r[1]);
  }
  const get = (label: string) => byLabel.get(label.toLowerCase());
  const positive = (label: string, max = Infinity): number | null => {
    const c = get(label);
    if (txt(c) === '') return null;
    const n = num(c);
    if (n === null || !(n > 0) || n > max) {
      s.problems.push(`Settings: "${label}" is "${txt(c)}", which is not a usable number, so it was ignored.`);
      return null;
    }
    return n;
  };
  const sd = get(SETTING_LABELS.statusDate);
  if (txt(sd) !== '') {
    const d = parseDateText(txt(sd), 'auto', 'statusDate');
    if (d.iso) s.statusDate = d.iso;
    else s.problems.push(`Settings: "Status date" is "${txt(sd)}". Write it as year-month-day, for example 2026-03-31. It was ignored.`);
  }
  s.hoursPerDay = positive(SETTING_LABELS.hoursPerDay, 24);
  s.capacity = positive(SETTING_LABELS.capacity, 168);
  s.defaultRate = positive(SETTING_LABELS.defaultRate);
  const dc = txt(get(SETTING_LABELS.dayCount));
  if (dc !== '') {
    const hit = DAY_CHOICES.find((d) => d.label.toLowerCase() === dc.toLowerCase());
    if (hit) s.dayCount = hit.value;
    else s.problems.push(`Settings: "Days counted" is "${dc}". Choose Weekdays or All days. It was ignored.`);
  }
  const rl = txt(get(SETTING_LABELS.rule));
  if (rl !== '') {
    const hit = RULE_CHOICES.find((d) => d.label.toLowerCase() === rl.toLowerCase());
    if (hit) s.rule = hit.rule;
    else s.problems.push(`Settings: "Progress rule" is "${rl}". Choose one from the list. It was ignored.`);
  }
  const cur = txt(get(SETTING_LABELS.currency));
  if (cur !== '') s.currency = cur.slice(0, 8);
  const band = (label: string): number | null => {
    const c = get(label);
    if (txt(c) === '') return null;
    const n = num(c);
    if (n === null || n <= 0 || n > 2) {
      s.problems.push(`Settings: "${label}" should be a number such as 0.95. It was ignored.`);
      return null;
    }
    return n;
  };
  s.greenMin = band(SETTING_LABELS.greenMin);
  s.amberMin = band(SETTING_LABELS.amberMin);
  if (s.greenMin !== null && s.amberMin !== null && s.amberMin >= s.greenMin) {
    s.problems.push('Settings: "Amber from" must be lower than "Green from". Both were ignored.');
    s.greenMin = null;
    s.amberMin = null;
  }
  const ip = get(SETTING_LABELS.inProgressPercent);
  if (txt(ip) !== '') {
    const n = num(ip);
    if (n === null || n < 0 || n > 100) s.problems.push('Settings: "In-progress credit (%)" should be 0 to 100. It was ignored.');
    else s.inProgressPercent = n;
  }
  return s;
}

/** Reads the Rates sheet (person in column A, hourly rate in column B, header row first). */
export function parseTemplateRates(grid: GridCell[][]): TemplateRates {
  const rates: Record<string, number> = {};
  const problems: string[] = [];
  grid.slice(1).forEach((r, i) => {
    const who = txt(r[0]);
    if (who === '' && txt(r[1]) === '') return;
    const n = num(r[1]);
    if (who === '' || n === null || n < 0) {
      problems.push(`Rates: row ${i + 2} ("${who}", "${txt(r[1])}") was not understood and was ignored.`);
      return;
    }
    rates[who] = n;
  });
  return { rates, problems };
}

export interface TemplateReadiness {
  /** Tasks counted (cancelled tasks are out of scope and not counted). */
  total: number;
  cancelled: number;
  /** For each metric: how many of the tasks have what it needs, and what is missing in plain words. */
  checks: { metric: string; ready: number; needs: string }[];
}

/** Counts, per metric, how many rows have the columns that metric needs. Blank means missing, never zero. */
export function templateReadiness(headers: string[], allRows: string[][]): TemplateReadiness {
  const iStatus = headers.indexOf('Status');
  const isCancelled = (r: string[]) => iStatus >= 0 && suggestStatusCategory(r[iStatus] ?? '') === 'cancelled';
  const rows = allRows.filter((r) => !isCancelled(r));
  const ix = (c: TemplateColumn) => headers.indexOf(c);
  const filled = (r: string[], c: TemplateColumn) => {
    const i = ix(c);
    return i >= 0 && (r[i] ?? '').trim() !== '';
  };
  const all = (...cs: TemplateColumn[]) => rows.filter((r) => cs.every((c) => filled(r, c))).length;
  return {
    total: rows.length,
    cancelled: allRows.length - rows.length,
    checks: [
      { metric: 'Cost (CPI, cost variance)', ready: all('Estimate (h)', 'Actual (h)', '% complete'), needs: 'Estimate (h), Actual (h) and % complete' },
      { metric: 'Schedule (SPI, schedule variance)', ready: all('Estimate (h)', 'Planned start', 'Planned finish', '% complete'), needs: 'Estimate (h), Planned start, Planned finish and % complete' },
      { metric: 'Flow (cycle time, throughput)', ready: all('Actual start', 'Actual finish'), needs: 'Actual start and Actual finish' },
      { metric: 'Resources', ready: all('Assignee', 'Estimate (h)'), needs: 'Assignee and Estimate (h)' },
      { metric: 'Quality (defects)', ready: all('Type', 'Created'), needs: 'Type and Created' },
    ],
  };
}

export interface TemplateParts {
  /** Index of the "Tasks" sheet. */
  tasksIndex: number;
  settings: TemplateSettings;
  rates: TemplateRates;
  /** True when a Settings sheet was present at all. */
  hasSettings: boolean;
}

/** Finds the Tasks / Settings / Rates sheets of a workbook by name. Null if there is no "Tasks" sheet. */
export function extractTemplate(sheets: { name: string; data: GridCell[][] }[]): TemplateParts | null {
  const find = (n: string) => sheets.findIndex((s) => s.name.trim().toLowerCase() === n);
  const t = find('tasks');
  if (t < 0) return null;
  const settingsSheet = sheets[find('settings')];
  const ratesSheet = sheets[find('rates')];
  return {
    tasksIndex: t,
    hasSettings: settingsSheet !== undefined,
    settings: settingsSheet ? parseTemplateSettings(settingsSheet.data) : parseTemplateSettings([]),
    rates: ratesSheet ? parseTemplateRates(ratesSheet.data) : { rates: {}, problems: [] },
  };
}

export interface TemplateProject {
  name: string;
  programme: string;
  team: string;
  table: { delimiter: ',' | ';' | '\t'; headers: string[]; rows: string[][]; warnings: string[] };
}

/**
 * Splits a filled template into one table per value of the Project column (in first-seen order).
 * Programme and Team are taken from the first non-blank value among a project's rows; if a project
 * names two different programmes the first is kept and the conflict is reported in warnings.
 * Rows with a blank Project go to "(no project named)". A file with no Project values at all is one project.
 */
export function splitTemplateProjects(table: TemplateProject['table']): { projects: TemplateProject[]; warnings: string[] } {
  const iP = table.headers.indexOf('Project');
  const iG = table.headers.indexOf('Programme');
  const iT = table.headers.indexOf('Team');
  const cell = (r: string[], i: number) => (i < 0 ? '' : (r[i] ?? '').trim());
  const groups = new Map<string, string[][]>();
  for (const r of table.rows) {
    const k = cell(r, iP) || '(no project named)';
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  const warnings: string[] = [];
  const projects: TemplateProject[] = [];
  for (const [name, rows] of groups) {
    const first = (i: number, what: string) => {
      const vals = [...new Set(rows.map((r) => cell(r, i)).filter((v) => v !== ''))];
      if (vals.length > 1) warnings.push(`Project "${name}" lists more than one ${what} (${vals.join(', ')}). The first, "${vals[0]}", was used.`);
      return vals[0] ?? '';
    };
    projects.push({ name, programme: first(iG, 'programme'), team: first(iT, 'team'), table: { ...table, rows } });
  }
  return { projects, warnings };
}
