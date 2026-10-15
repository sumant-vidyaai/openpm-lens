import type { EvmAggregate } from './aggregate';
import type { ScheduleAggregate } from './schedule';
import type { QualityReport } from './quality';
import type { EvmRow, ScheduleRow } from './explain';
import { roundHalfUp } from './format';
import type { ForecastResult } from './forecast';
import { EAC_METHODS } from './forecast';
import type { EarnedScheduleResult } from './earnedSchedule';

/**
 * Building shareable output: CSV text and the rows behind it.
 * Pure functions: the screen decides when to save, and passes in today's date.
 */
export type CsvCell = string | number | null;

/**
 * Text that a spreadsheet could run as a formula is prefixed with an apostrophe, so a task
 * named "=HYPERLINK(...)" in an imported file cannot do anything when the CSV is opened.
 * Numbers are never prefixed.
 */
function safeText(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function toCsv(rows: CsvCell[][]): string {
  const cell = (c: CsvCell): string => {
    if (c === null) return '';
    const s = typeof c === 'number' ? (Number.isFinite(c) ? String(c) : '') : safeText(c);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export interface ReportInput {
  fileName: string;
  /** Neutral tool name when a known export was recognised. */
  toolName: string | null;
  /** ISO date the report was made. */
  generatedOn: string;
  statusDate: string | null;
  assumptions: string[];
  evm: EvmAggregate | null;
  schedule: ScheduleAggregate | null;
  quality: QualityReport | null;
  forecast?: ForecastResult | null;
  earnedSchedule?: EarnedScheduleResult | null;
}

const r4 = (n: number | null): number | null => (n === null ? null : roundHalfUp(n, 4));

/** The summary table: what was measured, the value, its unit, and how much to trust it. */
export function summaryRows(input: ReportInput): CsvCell[][] {
  const rows: CsvCell[][] = [['Section', 'Item', 'Value', 'Unit', 'Note']];
  const add = (section: string, item: string, value: CsvCell, unit = '', note = '') => rows.push([section, item, value, unit, note]);

  add('Source', 'File', input.fileName);
  if (input.toolName) add('Source', 'Recognised as', input.toolName);
  add('Source', 'Report made on', input.generatedOn, '', 'Values rounded to 4 decimal places; calculations used unrounded values.');
  if (input.statusDate) add('Source', 'Status date', input.statusDate);
  for (const a of input.assumptions) add('Assumption', 'Setting', a);

  const e = input.evm;
  if (e) {
    if (e.status === 'not_available') {
      add('Cost', 'Result', 'Not available', '', `Missing: ${e.missing.join(', ')}`);
    } else {
      const cpi = e.ev !== null && e.ac !== null && e.ac !== 0 ? e.ev / e.ac : null;
      add('Cost', 'Earned value (EV)', r4(e.ev), 'hours', 'Planned hours x % complete, added up');
      add('Cost', 'Actual cost (AC)', r4(e.ac), 'hours', 'Hours actually spent');
      add('Cost', 'Cost performance index (CPI)', r4(cpi), 'ratio', 'EV / AC; below 1 means more hours spent than the work earned');
      add('Cost', 'Cost variance (CV)', e.ev !== null && e.ac !== null ? r4(e.ev - e.ac) : null, 'hours', 'EV - AC; negative means over budget');
      add('Cost', 'Tasks used', `${e.counts.used} of ${e.counts.total}`);
      for (const c of e.caveats) add('Cost', 'Caveat', c);
    }
  }
  const s = input.schedule;
  if (s) {
    if (s.status === 'not_available') {
      add('Schedule', 'Result', 'Not available', '', `Missing: ${s.missing.join(', ')}`);
    } else {
      add('Schedule', 'Planned value (PV)', r4(s.pv), 'hours', `Hours that should be done by ${input.statusDate ?? 'the status date'}`);
      add('Schedule', 'Earned value (EV)', r4(s.ev), 'hours', 'Same tasks, planned hours x % complete');
      add('Schedule', 'Schedule performance index (SPI)', r4(s.spi), 'ratio', s.spi === null ? 'Not available: planned value is 0' : 'EV / PV; below 1 means behind the plan');
      add('Schedule', 'Schedule variance (SV)', r4(s.sv), 'hours', 'EV - PV; negative means behind schedule');
      add('Schedule', 'Tasks used', `${s.counts.used} of ${s.counts.total}`);
      for (const c of s.caveats) add('Schedule', 'Caveat', c);
    }
  }
  const fc = input.forecast;
  if (fc) {
    const label = EAC_METHODS.find((m) => m.value === fc.method)?.formula ?? fc.method;
    add('Forecast', 'Method', label, '', 'You chose how the rest of the work is expected to go');
    add('Forecast', 'Budget at completion (BAC)', r4(fc.bac), 'hours', 'Planned hours of the tasks used; tasks left out are not in it');
    add('Forecast', 'Estimate at completion (EAC)', r4(fc.eac), 'hours');
    add('Forecast', 'Estimate to complete (ETC)', r4(fc.etc), 'hours', 'EAC - AC');
    add('Forecast', 'Variance at completion (VAC)', r4(fc.vac), 'hours', 'BAC - EAC; negative means a forecast overrun');
    add('Forecast', 'To-complete index vs budget (TCPI)', r4(fc.tcpiBac), 'ratio', '(BAC - EV) / (BAC - AC)');
    add('Forecast', 'To-complete index vs forecast (TCPI)', r4(fc.tcpiEac), 'ratio', '(BAC - EV) / (EAC - AC)');
    for (const r of fc.reasons) add('Forecast', 'Note', r);
  }
  const es = input.earnedSchedule;
  if (es) {
    if (es.status === 'not_available') add('Earned schedule', 'Result', 'Not available', '', es.reasons.join(' '));
    else {
      add('Earned schedule', 'Earned schedule (ES)', r4(es.es), 'days', 'Time at which the plan expected the work now earned');
      add('Earned schedule', 'Actual time (AT)', es.at, 'days', 'From the first planned start to the status date');
      add('Earned schedule', 'Schedule variance in time, SV(t)', r4(es.svT), 'days', 'ES - AT; negative means behind');
      add('Earned schedule', 'Schedule performance in time, SPI(t)', r4(es.spiT), 'ratio', 'ES / AT; below 1 means behind');
      for (const c of es.caveats) add('Earned schedule', 'Caveat', c);
    }
  }
  const q = input.quality;
  if (q) {
    add('Data quality', 'Score', q.score === null ? 'Insufficient data' : q.score, q.score === null ? '' : 'out of 100', q.reading);
    for (const f of q.fields) add('Data quality', `${f.label} present`, `${f.present} of ${f.total}`);
    add('Data quality', 'How the score works', q.how);
  }
  return rows;
}

/** One row per task with its contribution to the cost and schedule numbers. */
export function taskRows(evmRows: EvmRow[], schedRows: ScheduleRow[]): CsvCell[][] {
  const head: CsvCell[] = [
    'Task', 'Planned hours', '% complete', 'Actual hours', 'Adds to EV (cost)', 'Adds to AC', 'Cost status',
    'Planned start', 'Planned finish', 'Planned done by status date (%)', 'Adds to PV', 'Adds to EV (schedule)', 'Schedule status',
  ];
  const out: CsvCell[][] = [head];
  evmRows.forEach((e, i) => {
    const s = schedRows[i];
    out.push([
      e.id, r4(e.plannedHours), e.percentComplete, r4(e.actualHours), r4(e.ev), r4(e.ac), e.note,
      s?.plannedStart ?? null, s?.plannedFinish ?? null,
      s && s.plannedShare !== null ? roundHalfUp(s.plannedShare * 100, 1) : null,
      r4(s?.pv ?? null), r4(s?.ev ?? null), s ? s.note : null,
    ]);
  });
  return out;
}
