import readXlsxFile from 'read-excel-file/browser';
import { parseCsv, tableFromGrid, type CsvResult, type GridCell } from '@openpm-lens/core';

/** Reads a CSV or .xlsx file in the browser. For a workbook with several sheets the first is used. */
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
  if (/\.xls$/i.test(f.name)) {
    throw new Error(`${f.name}: old .xls files are not supported. In Excel choose Save As, then .xlsx or CSV.`);
  }
  return { table: parseCsv(await f.text()), note: null };
}
