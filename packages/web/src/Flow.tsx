import { ThroughputChart, CycleScatter } from './charts';
import { useMemo, useState } from 'react';
import {
  analyseFlow, buildFlowItems, MIN_FLOW_SAMPLE, parseCsv, roundHalfUp, suggestFlowColumns, toCsv,
  type CsvCell, type CsvResult, type DateOrder, type FlowColumns,
} from '@openpm-lens/core';
import { readTable } from './readFile';
import { SAMPLE_FLOW } from './sample';
import { StepsPanel } from './Explain';
import { ReplaceButton } from './common';

const FIELDS: { key: keyof FlowColumns; label: string }[] = [
  { key: 'name', label: 'Item name' },
  { key: 'id', label: 'Item ID' },
  { key: 'status', label: 'Status' },
  { key: 'start', label: 'Date work started' },
  { key: 'done', label: 'Date finished (done, resolved, closed)' },
];

export function FlowScreen() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<CsvResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Partial<FlowColumns>>({});
  const [statusDate, setStatusDate] = useState('');
  const [weeks, setWeeks] = useState(8);
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto');

  const cols: FlowColumns | null = useMemo(() => (table ? { ...suggestFlowColumns(table.headers), ...edits } : null), [table, edits]);
  const flow = useMemo(() => {
    if (!table || !cols || !statusDate || (cols.start === null && cols.done === null)) return null;
    return analyseFlow(buildFlowItems(table.headers, table.rows, cols, dateOrder), { statusDate, weeks });
  }, [table, cols, statusDate, weeks, dateOrder]);

  async function onFile(f: File) {
    try {
      const r = await readTable(f);
      setFileName(f.name); setTable(r.table); setNote(r.note); setError(null); setEdits({});
      if (r.template?.settings.statusDate) setStatusDate(r.template.settings.statusDate);
    } catch (e) { setError(e instanceof Error ? e.message : 'This file could not be read.'); }
  }
  const f = (n: number | null, d = 1) => (n === null ? 'Not available' : String(roundHalfUp(n, d)));
  const startIsCreated = cols?.start != null && /creat/i.test(cols.start);
  const assumptions = [
    `Status date: ${statusDate || 'not chosen'}. Window: the last ${weeks} block${weeks === 1 ? '' : 's'} of 7 days ending on it.`,
    'Days are calendar days, counted from the start date to the done date including both (same day = 1 day).',
    'Percentiles use the nearest-rank method and need at least ' + MIN_FLOW_SAMPLE + ' finished items.',
    `Date order: ${dateOrder === 'auto' ? 'unclear dates are refused' : dateOrder === 'dmy' ? 'day / month / year' : 'month / day / year'}.`,
    'Definitions follow the Kanban Guide (WIP, throughput, cycle time, work item age). How days are counted and the percentile method are this app\'s own rules.',
  ];

  function download() {
    if (!flow) return;
    const rows: CsvCell[][] = [['Section', 'Item', 'Value', 'Unit', 'Note']];
    const add = (s: string, i: string, v: CsvCell, u = '', n = '') => rows.push([s, i, v, u, n]);
    add('Source', 'File', fileName ?? ''); add('Source', 'Status date', statusDate);
    add('Source', 'Report made on', new Date().toLocaleDateString('en-CA'), '', 'Values rounded to 4 decimal places.');
    assumptions.forEach((a) => add('Assumption', 'Setting', a));
    add('Flow', 'Work in progress (WIP)', flow.wip, 'items', 'Started but not finished by the status date');
    add('Flow', 'Throughput per week', roundHalfUp(flow.throughputPerWeek ?? 0, 4), 'items/week', `${flow.throughputTotal} finished in ${weeks} block(s) of 7 days`);
    flow.throughput.forEach((b) => add('Throughput', `${b.from} to ${b.to}`, b.count, 'items'));
    if (flow.cycle) {
      add('Cycle time', 'Items measured', flow.cycle.n); add('Cycle time', 'Mean', roundHalfUp(flow.cycle.mean, 4), 'days');
      add('Cycle time', 'Shortest', flow.cycle.min, 'days'); add('Cycle time', 'Longest', flow.cycle.max, 'days');
      add('Cycle time', '50th percentile', flow.cycle.p50 ?? 'Insufficient data', flow.cycle.p50 === null ? '' : 'days');
      add('Cycle time', '85th percentile', flow.cycle.p85 ?? 'Insufficient data', flow.cycle.p85 === null ? '' : 'days');
    } else add('Cycle time', 'Result', 'Not available');
    flow.aging.forEach((a) => add('Aging', `${a.id} ${a.name}`, a.age, 'days', `Started ${a.start}${a.olderThanP85 ? '; older than the 85th percentile of cycle time' : ''}`));
    flow.excluded.forEach((e) => add('Left out', `${e.id} ${e.name}`, e.reason));
    flow.caveats.forEach((c) => add('Caveat', 'Note', c));
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `openpm-lens-flow-${statusDate}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-labelledby="flow-h">
      <h2 id="flow-h">Flow metrics</h2>
      <p className="lead">
        How fast and how steadily work flows: items finished per week, how long items take, how much is in progress and how old it is.
        These need the dates work actually started and finished, not planned dates. The file is read in this browser tab only.
      </p>
      <div className="row">
        <label className="btn">
          Choose file{' '}
          <input type="file" accept=".csv,text/csv,.txt,.xlsx" onChange={async (e) => { const x = e.target.files?.[0]; const input = e.target; if (x) await onFile(x); input.value = ''; }} />
        </label>
        <ReplaceButton loaded={table !== null && fileName !== 'flow-sample.csv (made-up example)'} what={fileName ?? 'your file'} label="Try the made-up example" onConfirm={() => { setFileName('flow-sample.csv (made-up example)'); setTable(parseCsv(SAMPLE_FLOW)); setNote(null); setError(null); setEdits({}); setStatusDate('2026-01-28'); setWeeks(2); }} />
        {table !== null && <ReplaceButton loaded={fileName !== 'flow-sample.csv (made-up example)'} what={fileName ?? 'your file'} label="Clear" verb="removes" confirmLabel="Clear" onConfirm={() => { setFileName(null); setTable(null); setNote(null); setError(null); setEdits({}); }} />}
      </div>
      {error && <p className="warn" role="alert">{error}</p>}
      {table && cols && (
        <>
          <p><strong>{fileName}</strong>: {table.rows.length} rows, {table.headers.length} columns. {note}</p>
          <h3>1. Which column is which?</h3>
          <div className="form">
            {FIELDS.map(({ key, label }) => (
              <label key={key}>{label}
                <select value={cols[key] ?? ''} onChange={(e) => setEdits((m) => ({ ...m, [key]: e.target.value === '' ? null : e.target.value }))}>
                  <option value="">Not in my file</option>
                  {table.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          {cols.start === null && <p className="warn">No "date work started" column was chosen. Without it there is no cycle time, WIP or age; only throughput. Created dates are not guessed, because they give lead time (request to done), not cycle time.</p>}
          {startIsCreated && <p className="warn">That column looks like a creation date. Using it gives lead time (from request to done), not cycle time. Read the results as lead time.</p>}
          <h3>2. Settings</h3>
          <div className="form">
            <label>Status date (numbers are as of this day)
              <span className="row">
                <input type="date" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} />
                <button type="button" onClick={() => setStatusDate(new Date().toLocaleDateString('en-CA'))}>Use today</button>
              </span>
            </label>
            <label>Look back (blocks of 7 days)
              <input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.min(52, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} />
            </label>
            <label>Dates in my file are written as
              <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                <option value="auto">Unclear ones are refused (recommended)</option>
                <option value="dmy">Day / Month / Year</option>
                <option value="mdy">Month / Day / Year</option>
              </select>
            </label>
          </div>
          {!statusDate && <p className="warn">Choose a status date to see results. It is not assumed.</p>}
          {flow && (
            <div aria-live="polite">
              <h3>Results</h3>
              <div className="grid">
                <div className="card"><h4>Work in progress (WIP)</h4><p className="big">{flow.wip}</p><p className="note">Items started but not finished by {statusDate}.</p></div>
                <div className="card"><h4>Throughput per week</h4><p className="big">{f(flow.throughputPerWeek, 2)}</p><p className="note">{flow.throughputTotal} items finished in the last {weeks} block{weeks === 1 ? '' : 's'} of 7 days.</p></div>
                <div className="card"><h4>Cycle time, typical (50th percentile)</h4><p className="big">{flow.cycle === null ? 'Not available' : flow.cycle.p50 === null ? 'Insufficient data' : `${flow.cycle.p50} days`}</p><p className="note">Half of finished items took this long or less.</p></div>
                <div className="card"><h4>Cycle time, 85th percentile</h4><p className="big">{flow.cycle === null ? 'Not available' : flow.cycle.p85 === null ? 'Insufficient data' : `${flow.cycle.p85} days`}</p><p className="note">85% of finished items took this long or less. Based on {flow.cycle?.n ?? 0} items.</p></div>
                {flow.cycle && <div className="card"><h4>Cycle time, average</h4><p className="big">{f(flow.cycle.mean, 1)} days</p><p className="note">Shortest {flow.cycle.min}, longest {flow.cycle.max}. An average can hide a long tail.</p></div>}
              </div>
              {flow.caveats.map((c) => <p key={c} className="warn">{c}</p>)}
              <ThroughputChart blocks={flow.throughput} />
              <CycleScatter points={flow.points} p50={flow.cycle?.p50 ?? null} p85={flow.cycle?.p85 ?? null} />
              <div className="scroll" tabIndex={0}>
                <table>
                  <caption>Items finished in each block of 7 days</caption>
                  <thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col">Items finished</th></tr></thead>
                  <tbody>{flow.throughput.map((b) => <tr key={b.from}><td>{b.from}</td><td>{b.to}</td><td>{b.count}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="scroll" tabIndex={0}>
                <table>
                  <caption>Work in progress, oldest first (age in days)</caption>
                  <thead><tr><th scope="col">Item</th><th scope="col">Started</th><th scope="col">Age (days)</th><th scope="col">Compared with finished items</th></tr></thead>
                  <tbody>
                    {flow.aging.length === 0 && <tr><td colSpan={4}>Nothing in progress.</td></tr>}
                    {flow.aging.slice(0, 50).map((a) => (
                      <tr key={a.id}>
                        <th scope="row">{a.id} {a.name !== a.id ? a.name : ''}</th><td>{a.start}</td><td>{a.age}</td>
                        <td>{a.olderThanP85 === null ? 'Not enough finished items to compare' : a.olderThanP85 ? '▲ Older than 85% of finished items took' : 'Within the usual range'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {flow.aging.length > 50 && <p className="note">Showing the oldest 50 of {flow.aging.length}.</p>}
              {flow.excluded.length > 0 && (
                <details>
                  <summary>Items left out, and why ({flow.excluded.length})</summary>
                  <ul>{flow.excluded.map((e) => <li key={e.id}>{e.id} {e.name !== e.id ? e.name : ''}: {e.reason}</li>)}</ul>
                </details>
              )}
              <StepsPanel title="Show the working for the flow numbers" assumptions={assumptions} groups={flow.steps} />
              <p><button type="button" onClick={download}>Download flow results (CSV)</button></p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
