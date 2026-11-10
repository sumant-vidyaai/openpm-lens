import { useState } from 'react';
import { PROJECT_LIST_FIELDS, projectListFromTable, suggestProjectListMapping, type CsvResult, type ProjectListMapping, type RegisterRow } from '@spashta/core';
import { readTable } from './readFile';

/** Loads a list of projects (any CSV or Excel file) and matches its columns to the Projects register used by the phase and update views. */
export function ProjectListImport({ onRegister, loaded }: { onRegister: (rows: RegisterRow[]) => void; loaded: number }) {
  const [table, setTable] = useState<CsvResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ProjectListMapping | null>(null);
  const [message, setMessage] = useState('');

  async function onFile(f: File) {
    setMessage('');
    try {
      const r = await readTable(f);
      setTable(r.table); setFileName(f.name); setMapping(suggestProjectListMapping(r.table.headers));
      if (r.note) setMessage(r.note);
    } catch (err) {
      setTable(null); setMapping(null);
      setMessage(err instanceof Error ? err.message : `${f.name} could not be read.`);
    }
  }
  function use() {
    if (table === null || mapping === null) return;
    const r = projectListFromTable(table, mapping);
    if (r.rows.length > 0) onRegister(r.rows);
    setMessage(r.rows.length > 0 ? `${r.rows.length} project${r.rows.length === 1 ? '' : 's'} read from ${fileName}. ${r.problems.join(' ')}` : r.problems.join(' ') || 'No projects were found in that file.');
  }

  return (
    <details className="explain noprint">
      <summary>Load a project list (names, phase, manager)</summary>
      <p className="note">
        Use this for a plain list of projects, such as a register kept in Excel, Smartsheet or any tool that can export CSV or .xlsx. It fills the phase and update views (section 5), which appear once at least one project is loaded above.
        The list itself gives no task numbers or health: for that, load one task file per project.
        Columns are only suggested: please check each choice. A column you leave as "none" stays blank.
      </p>
      <div className="row">
        <label className="btn">
          Choose list file{' '}
          <input type="file" accept=".csv,text/csv,.txt,.xlsx" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await onFile(f); e.target.value = ''; }} />
        </label>
        {loaded > 0 && <span className="note">{loaded} project{loaded === 1 ? '' : 's'} in the list now.</span>}
      </div>
      {table !== null && mapping !== null && (
        <>
          <div className="form">
            {PROJECT_LIST_FIELDS.map((f) => (
              <label key={f.field}>{f.label}{f.required ? ' (required)' : ''}
                <select value={mapping[f.field] ?? ''} onChange={(e) => setMapping({ ...mapping, [f.field]: e.target.value === '' ? null : e.target.value })}>
                  <option value="">none</option>
                  {table.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <p className="note">{table.rows.length} row{table.rows.length === 1 ? '' : 's'} in {fileName}.</p>
          <button type="button" onClick={use}>Use this list</button>
        </>
      )}
      {message !== '' && <p className="note" role="status">{message}</p>}
    </details>
  );
}
