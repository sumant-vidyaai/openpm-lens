// The "universal" build parses on the main thread. The "browser" build starts a blob web worker, which this
// app's Content-Security-Policy (script-src 'self') correctly forbids.
import readXlsxFile from 'read-excel-file/universal';
import { unzipSync, zipSync } from 'fflate';
import { extractTemplate, parseCsv, parseMspdi, tableFromGrid, type CsvResult, type GridCell, type TemplateParts } from '@spashta/core';

export const MAX_XML_BYTES = 25 * 1024 * 1024;
/** fflate unpacks a sheet larger than about 512 KB (unpacked) in a web worker, which the app's security policy blocks. */

/**
 * The Excel reader unpacks any sheet over about 500 KB in a web worker, which this app's security policy blocks,
 * so a large workbook would hang with no message. Here the file is unpacked without a worker and packed again
 * uncompressed, which the reader handles on the main thread. Nothing leaves the browser.
 */
export async function makeReadable(f: File): Promise<Blob> {
  const entries = unzipSync(new Uint8Array(await f.arrayBuffer()));
  const stored: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const [name, data] of Object.entries(entries)) stored[name] = [data, { level: 0 }];
  return new Blob([zipSync(stored) as BlobPart]);
}

const READ_TIMEOUT_MS = 30000;

/** Reads every sheet of an .xlsx file in this tab. Explains the limit when a large workbook cannot be read. */
export async function readWorkbook(f: File): Promise<{ sheet: string; data: GridCell[][] }[]> {
  try {
    const readable = await makeReadable(f);
    const sheets = await Promise.race([
      readXlsxFile(readable),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('it took longer than 30 seconds')), READ_TIMEOUT_MS)),
    ]);
    return sheets.map((s) => ({ sheet: s.sheet, data: s.data as GridCell[][] }));
  } catch (err) {
    const why = err instanceof Error ? err.message : 'unknown reason';
    throw new Error(`${f.name}: the Excel file could not be read (${why}). Check that it opens in Excel. A workbook with a very large sheet cannot always be read here: save that sheet as CSV and load the CSV instead.`);
  }
}

/** Reads a CSV, .xlsx or Microsoft Project .xml file in the browser. For a workbook with several sheets the first is used. */
export async function readTable(f: File): Promise<{ table: CsvResult; note: string | null; template: TemplateParts | null }> {
  if (/\.xlsx$/i.test(f.name)) {
    const sheets = await readWorkbook(f);
    const first = sheets[0];
    if (!first) throw new Error(`${f.name}: the workbook has no sheets.`);
    const tpl = extractTemplate(sheets.map((s) => ({ name: s.sheet, data: s.data })));
    if (tpl) return { table: tableFromGrid(sheets[tpl.tasksIndex]?.data ?? []), note: null, template: tpl };
    return {
      table: tableFromGrid(first.data),
      note: sheets.length > 1 ? `Only the first sheet ("${first.sheet}") was read. Use the Import tab to pick another sheet.` : null,
      template: null,
    };
  }
  if (/\.xml$/i.test(f.name)) {
    if (f.size > MAX_XML_BYTES) throw new Error(`${f.name}: the XML file is larger than 25 MB, which is more than a project plan should be. It was not read.`);
    const r = parseMspdi(await f.text());
    return { table: r.table, note: r.notes.slice(0, 3).join(' '), template: null };
  }
  if (/\.xls$/i.test(f.name)) {
    throw new Error(`${f.name}: old .xls files are not supported. In Excel choose Save As, then .xlsx or CSV.`);
  }
  return { table: parseCsv(await f.text()), note: null, template: null };
}
