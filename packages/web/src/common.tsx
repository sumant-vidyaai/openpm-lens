import { toCsv, type CsvCell } from '@openpm-lens/core';

export function NeedsImport({ onGo }: { onGo: () => void }) {
  return (
    <div className="card" role="note">
      <p>
        This tab uses the file you set up on the Import tab: load the file there, check the column choices and units, then come back.
        Nothing is uploaded.
      </p>
      <button type="button" onClick={onGo}>Go to the Import tab</button>
    </div>
  );
}

export function saveCsv(name: string, rows: CsvCell[][]) {
  const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Guess a column holding who a task is assigned to. The user can always change it. */
export function suggestAssignee(headers: string[]): string | null {
  for (const re of [/^(assignee|assigned to|owner|resource names?|responsible|person)$/i, /assign|owner|resource name/i]) {
    const hit = headers.find((h) => re.test(h.trim()));
    if (hit) return hit;
  }
  return null;
}

export function ColumnSelect(props: { label: string; headers: string[]; value: string | null; onChange: (v: string | null) => void; none?: string }) {
  return (
    <label>
      {props.label}
      <select value={props.value ?? ''} onChange={(e) => props.onChange(e.target.value === '' ? null : e.target.value)}>
        <option value="">{props.none ?? 'Not in my file'}</option>
        {props.headers.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  );
}
