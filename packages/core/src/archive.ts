import { toCsv, type CsvCell } from './report';
import { buildZip, readZip, zipText } from './zip';
import { parseCsv, type GridCell } from './csv';

export interface ArchiveInput {
  fileName: string;
  statusDate: string | null;
  exportedAt: Date;
  version: string;
  /** The task table as loaded. */
  tasks: { headers: string[]; rows: string[][] };
  /** Each present optional sheet as rows of cells (heading row first). Absent sheets are simply not listed. */
  sections: { file: string; title: string; rows: CsvCell[][] }[];
  /** Saved snapshots, already as the JSON text the app stores (null when there are none). */
  snapshotsJson: string | null;
}

const csv = (rows: CsvCell[][]) => '﻿' + toCsv(rows);

/** Builds the archive: tasks.csv, one csv per filled sheet, snapshots.json if any, and a README.txt that lists what is inside. Nothing is invented or recalculated. */
export function makeArchive(a: ArchiveInput): Uint8Array {
  const files: { name: string; data: string }[] = [];
  const lines: string[] = [];
  if (a.tasks.headers.length > 0) {
    files.push({ name: 'tasks.csv', data: csv([a.tasks.headers, ...a.tasks.rows]) });
    lines.push(`tasks.csv - the task table as loaded (${a.tasks.rows.length} rows)`);
  } else lines.push('(no task file was loaded, so there is no tasks.csv)');
  for (const s of a.sections) { files.push({ name: s.file, data: csv(s.rows) }); lines.push(`${s.file} - ${s.title} (${Math.max(0, s.rows.length - 1)} rows)`); }
  if (a.snapshotsJson) { files.push({ name: 'snapshots.json', data: a.snapshotsJson }); lines.push('snapshots.json - snapshots saved in this browser (plain JSON)'); }
  const readme = [
    'Spashta archive',
    '',
    `Source file: ${a.fileName || '(not named)'}`,
    `Status date: ${a.statusDate || 'not set'}`,
    `Exported: ${a.exportedAt.toISOString()}`,
    `Spashta version: ${a.version}`,
    '',
    'Contents:',
    ...lines.map((l) => `  ${l}`),
    '',
    'These are copies of the data you loaded, exactly as read. No figures were recalculated for the archive.',
    'CSV files open in Excel or any spreadsheet. Dates are year-month-day. A blank cell means "not known", never 0.',
    '',
  ].join('\r\n');
  files.push({ name: 'README.txt', data: readme });
  return buildZip(files, a.exportedAt);
}

/* ---------- loading an archive back ---------- */

/** Archive file name -> the template sheet it came from (the same sheet names the parsers look for). */
const SHEET_OF: Record<string, string> = {
  'risks.csv': 'Risks', 'issues.csv': 'Issues', 'changes.csv': 'Changes', 'scoring.csv': 'Scoring', 'business-case.csv': 'Business case',
  'stakeholders.csv': 'Stakeholders', 'rfi-rfp.csv': 'RFI-RFP', 'go-no-go.csv': 'Go-no-go', 'gate-checklist.csv': 'Gate checklist',
  'checklist.csv': 'Checklist', 'lessons.csv': 'Lessons', 'benefits.csv': 'Benefits',
};
export interface LoadedArchive {
  /** Task table first, then each sheet; names match the template so the normal readers work. */
  sheets: { name: string; data: GridCell[][] }[];
  /** True when the task table has no "Tasks" sheet name because its columns are not the template's. */
  tasksAreGeneric: boolean;
  statusDate: string | null;
  sourceFile: string | null;
  version: string | null;
  hasSnapshots: boolean;
  problems: string[];
}

const gridOf = (text: string): GridCell[][] => { const t = parseCsv(text); return [t.headers, ...t.rows] as GridCell[][]; };

/** Reads a Spashta archive (the zip made by "Download archive") back into sheets. Anything not made by Spashta is refused rather than guessed at. */
export async function loadArchive(bytes: Uint8Array, isTemplateHeaders: (h: string[]) => boolean): Promise<LoadedArchive> {
  const files = await readZip(bytes);
  const readme = files.find((f) => f.name === 'README.txt');
  const text = readme ? zipText(readme) : '';
  if (!/^\s*Spashta archive/i.test(text.replace(/^﻿/, ''))) throw new Error('This zip is not a Spashta archive (its README.txt is missing or does not start with "Spashta archive"). Unzip it and load the CSV or Excel file inside instead.');
  const line = (label: string) => { const m = new RegExp(`^${label}:\\s*(.*)$`, 'mi').exec(text); return m ? (m[1] ?? '').trim() : null; };
  const sd = line('Status date');
  const statusDate = sd && /^\d{4}-\d{2}-\d{2}$/.test(sd) ? sd : null;
  const sheets: LoadedArchive['sheets'] = [];
  const problems: string[] = [];
  let tasksAreGeneric = false;
  const tasks = files.find((f) => f.name === 'tasks.csv');
  if (tasks) {
    const grid = gridOf(zipText(tasks));
    tasksAreGeneric = !isTemplateHeaders((grid[0] ?? []).map(String));
    sheets.push({ name: tasksAreGeneric ? 'Archived tasks' : 'Tasks', data: grid });
  } else problems.push('The archive has no tasks.csv, so there is no task table to analyse. The other sheets were loaded.');
  for (const f of files) {
    const sheet = SHEET_OF[f.name];
    if (sheet) sheets.push({ name: sheet, data: gridOf(zipText(f)) });
    else if (f.name !== 'tasks.csv' && f.name !== 'README.txt' && f.name !== 'snapshots.json') problems.push(`"${f.name}" in the archive is not a file this version knows, so it was skipped.`);
  }
  if (statusDate && !tasksAreGeneric) sheets.push({ name: 'Settings', data: [['Setting', 'Value'], ['Status date', statusDate]] });
  return { sheets, tasksAreGeneric, statusDate, sourceFile: line('Source file'), version: line('Spashta version'), hasSnapshots: files.some((f) => f.name === 'snapshots.json'), problems };
}
