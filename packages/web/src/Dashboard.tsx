import { useEffect, useMemo, useState } from 'react';
import { HEALTH_LABEL, assessHealth, roundHalfUp, sumSubset, type HealthThresholds } from '@openpm-lens/core';
import { ColumnSelect, suggestAssignee } from './common';
import type { SharedData } from './shared';

const GUESS = [/^(team|squad)$/i, /^(project|programme|program)$/i];
const MAX_VALUES = 60;

/** Pick a column and a value (a person, a status, a team) and see the same health numbers for just those rows. */
export function GroupFilter({ shared, th }: { shared: SharedData; th: HealthThresholds }) {
  const { headers, rows } = shared.table;
  const [col, setCol] = useState<string | null | undefined>(undefined);
  const [value, setValue] = useState('');
  useEffect(() => { setCol(undefined); setValue(''); }, [shared.fileName, shared.table]);
  const column = col === undefined ? (suggestAssignee(headers) ?? headers.find((h) => GUESS.some((g) => g.test(h.trim()))) ?? null) : col;
  const j = column === null ? -1 : headers.indexOf(column);
  const values = useMemo(() => {
    if (j < 0) return [];
    const m = new Map<string, number>();
    for (const r of rows) { const v = (r[j] ?? '').trim(); if (v !== '') m.set(v, (m.get(v) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [rows, j]);
  const idx = useMemo(() => (j < 0 || value === '' ? [] : rows.flatMap((r, i) => ((r[j] ?? '').trim() === value ? [i] : []))), [rows, j, value]);
  const sums = useMemo(() => (value === '' ? null : sumSubset(shared.evmRows, shared.schedRows, idx)), [shared, idx, value]);
  const h = sums ? assessHealth({ ev: sums.ev, ac: sums.ac, costTasks: sums.costTasks, evSchedule: sums.evSchedule, pv: sums.pv, scheduleTasks: sums.scheduleTasks }, th) : null;
  const cat = (c: string) => idx.filter((i) => shared.items[i]?.statusCategory === c).length;
  const active = idx.length - cat('cancelled');
  const x = (n: number | null) => (n === null ? 'n/a' : String(roundHalfUp(n, 2)));

  return (
    <div className="panel" aria-labelledby="gf-h">
      <h3 id="gf-h">Look at one group</h3>
      <p className="note">Choose a column such as the person or the team, then a value. The same cost and schedule numbers are worked out for just those rows.</p>
      <div className="form">
        <ColumnSelect label="Group by column" headers={headers} value={column} onChange={(v) => { setCol(v); setValue(''); }} />
        <label>Value
          <select value={value} onChange={(e) => setValue(e.target.value)} disabled={values.length === 0}>
            <option value="">Choose a value</option>
            {values.slice(0, MAX_VALUES).map(([v, n]) => <option key={v} value={v}>{v} ({n})</option>)}
          </select>
        </label>
      </div>
      {values.length > MAX_VALUES && <p className="note">Showing the {MAX_VALUES} most common of {values.length} values.</p>}
      {column !== null && values.length === 0 && <p className="note">That column has no values to group by.</p>}
      {sums && h && (
        <>
          <p><strong>{value}</strong>: {idx.length} row{idx.length === 1 ? '' : 's'} ({cat('done')} done, {cat('in_progress')} in progress, {cat('not_started')} not started{cat('cancelled') > 0 ? `, ${cat('cancelled')} cancelled` : ''}).</p>
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Numbers for {value}</caption>
              <thead><tr><th scope="col">Health</th><th scope="col">CPI</th><th scope="col">SPI</th><th scope="col">Earned (h)</th><th scope="col">Spent (h)</th><th scope="col">Budget (h)</th></tr></thead>
              <tbody><tr><td>{HEALTH_LABEL[h.health]}</td><td>{x(h.cpi)}</td><td>{x(h.spi)}</td><td>{x(sums.ev)}</td><td>{x(sums.ac)}</td><td>{x(sums.bac)}</td></tr></tbody>
            </table>
          </div>
          {active > 0 && <label>Items done: <strong>{cat('done')} of {active}</strong><progress max={1} value={cat('done') / active} aria-label="Items done">{cat('done')} of {active}</progress></label>}
          {h.reasons.some((r) => /not used|not available/i.test(r)) && <ul className="plain">{h.reasons.filter((r) => /not used|not available/i.test(r)).map((r) => <li key={r}>{r}</li>)}</ul>}
          <p className="note">A small group has few tasks, so its health can swing. With fewer than {th.minTasks} tasks behind an index it is not used.</p>
        </>
      )}
    </div>
  );
}
