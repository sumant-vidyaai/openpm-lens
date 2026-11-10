import { toCsv, type CsvCell } from './report';
import { buildZip } from './zip';

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
  const files: { name: string; data: string }[] = [{ name: 'tasks.csv', data: csv([a.tasks.headers, ...a.tasks.rows]) }];
  const lines = [`tasks.csv - the task table as loaded (${a.tasks.rows.length} rows)`];
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
