import readXlsxFile from 'read-excel-file/browser';
import { parseCsv, parseMspdi, tableFromGrid, type CsvResult, type GridCell } from '@openpm-lens/core';

export const MAX_XML_BYTES = 25 * 1024 * 1024;

/** Reads a CSV, .xlsx or Microsoft Project .xml file in the browser. For a workbook with several sheets the first is used. */
export async function readTable(f: File): Promise<{ table: CsvResult; note: string | null }> {
  if (/\.xlsx$/i.test(f.name)) {
    const sheets = await readXlsxFile(f);
    const first = sheets[0];
    if (!first) throw new Error(`${f.name}: the workbook has no sheets.`);
    return {
      table: tableFromGrid(first.data as GridCell[][]),
      note: sheets.length > 1 ? `Only the first sheet ("${first.sheet}") was read. Use the Import tab to pick another sheet.` : null,
    };
  }
  if (/\.xml$/i.test(f.name)) {
    if (f.size > MAX_XML_BYTES) throw new Error(`${f.name}: the XML file is larger than 25 MB, which is more than a project plan should be. It was not read.`);
    const r = parseMspdi(await f.text());
    return { table: r.table, note: r.notes.slice(0, 3).join(' ') };
  }
  if (/\.xls$/i.test(f.name)) {
    throw new Error(`${f.name}: old .xls files are not supported. In Excel choose Save As, then .xlsx or CSV.`);
  }
  return { table: parseCsv(await f.text()), note: null };
}
