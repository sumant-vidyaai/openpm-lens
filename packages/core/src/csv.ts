/**
 * Minimal CSV reader (RFC 4180 style): quoted cells, escaped quotes (""), commas or
 * semicolons or tabs as separators, Windows or Unix line endings, optional byte-order mark.
 * Runs in the browser; nothing is sent anywhere.
 */

export type Delimiter = ',' | ';' | '\t';

export interface CsvResult {
  delimiter: Delimiter;
  /** First row. Blank headers become "Column N" so every column can be mapped. */
  headers: string[];
  /** Remaining rows, each padded or cut to the number of headers. Fully blank rows are dropped. */
  rows: string[][];
  warnings: string[];
}

function detectDelimiter(firstLine: string): Delimiter {
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === ',' || ch === ';' || ch === '\t')) counts[ch] += 1;
  }
  if (counts['\t'] > counts[','] && counts['\t'] >= counts[';']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

export function parseCsv(input: string, delimiter?: Delimiter): CsvResult {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = delimiter ?? detectDelimiter(firstLine);
  const warnings: string[] = [];

  const all: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      all.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
    i += 1;
  }
  if (inQuotes) warnings.push('A quoted cell was never closed; the last cells may be wrong.');
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    all.push(row);
  }

  const nonBlank = all.filter((r) => r.some((c) => c.trim() !== ''));
  const headerRow = nonBlank[0] ?? [];
  const headers = headerRow.map((h, idx) => (h.trim() === '' ? `Column ${idx + 1}` : h.trim()));
  const width = headers.length;
  let ragged = 0;
  const rows = nonBlank.slice(1).map((r) => {
    if (r.length !== width) ragged += 1;
    const fixed = r.slice(0, width);
    while (fixed.length < width) fixed.push('');
    return fixed;
  });
  if (ragged > 0) warnings.push(`${ragged} row(s) had a different number of cells than the header; padded or cut.`);

  return { delimiter: delim, headers, rows, warnings };
}
