import { useEffect, useMemo, useState } from 'react';
import { analyseFinish, MIN_FLOW_SAMPLE, parseDateText, roundHalfUp, suggestFlowColumns, type CsvCell, type FinishItem } from '@openpm-lens/core';
import { ColumnSelect, NeedsImport, saveCsv } from './common';
import { StepsPanel } from './Explain';
import { MilestoneSection } from './Milestones';
import type { SharedData } from './shared';

export function ScheduleScreen({ shared, onGoImport }: { shared: SharedData | null; onGoImport: () => void }) {
  const [col, setCol] = useState<string | null | undefined>(undefined);
  useEffect(() => setCol(undefined), [shared?.fileName, shared?.table]);
  const actualCol = col === undefined ? (shared ? suggestFlowColumns(shared.table.headers).done : null) : col;

  const result = useMemo(() => {
    if (!shared || !shared.statusDate) return null;
    const idx = actualCol === null ? -1 : shared.table.headers.indexOf(actualCol);
    const items: FinishItem[] = shared.items.map((it, i) => {
      const issues = it.issues.filter((x) => x.field === 'plannedFinish');
      let actual: string | null = null;
      const text = idx < 0 ? '' : (shared.table.rows[i]?.[idx] ?? '').trim();
      if (text !== '') {
        const d = parseDateText(text, shared.dateOrder, 'actualFinish');
        actual = d.iso;
        if (d.issue) issues.push(d.issue);
      }
      return { id: it.id, name: it.name, plannedFinish: it.baselineFinish, actualFinish: actual, cancelled: it.statusCategory === 'cancelled', markedDone: it.statusCategory === 'done', issues };
    });
    return analyseFinish(items, shared.statusDate);
  }, [shared, actualCol]);

  const assumptions = shared ? [
    `File: ${shared.fileName}. Status date: ${shared.statusDate || 'not chosen'}.`,
    'Variance = actual finish - planned finish, in calendar days (positive = late). On time = finished on or before the planned finish.',
    `On-time percentage and median need at least ${MIN_FLOW_SAMPLE} finished tasks, otherwise they say "Insufficient data". These rules are this app's own, not a standard.`,
    `Date order: ${shared.dateOrder === 'auto' ? 'unclear dates are refused' : shared.dateOrder === 'dmy' ? 'day / month / year' : 'month / day / year'}.`,
  ] : [];
  const f = (n: number | null, d = 1) => (n === null ? 'Not available' : String(roundHalfUp(n, d)));

  function download() {
    if (!result || !shared) return;
    const rows: CsvCell[][] = [['Section', 'Item', 'Value', 'Unit', 'Note']];
    const add = (s: string, i: string, v: CsvCell, u = '', n = '') => rows.push([s, i, v, u, n]);
    add('Source', 'File', shared.fileName); add('Source', 'Status date', shared.statusDate);
    add('Source', 'Report made on', new Date().toLocaleDateString('en-CA'), '', 'Values rounded to 4 decimal places.');
    assumptions.forEach((a) => add('Assumption', 'Setting', a));
    add('Finish dates', 'Finished tasks measured', result.finished);
    add('Finish dates', 'On time', result.onTimePercent ?? 'Insufficient data', result.onTimePercent === null ? '' : '%', `${result.onTime} on time, ${result.late} late`);
    add('Finish dates', 'Mean variance', result.meanVariance === null ? null : roundHalfUp(result.meanVariance, 4), 'days', 'Positive = late');
    add('Finish dates', 'Median variance', result.medianVariance ?? 'Insufficient data', result.medianVariance === null ? '' : 'days');
    add('Finish dates', 'Worst lateness', result.worstLate, 'days');
    add('Finish dates', 'Overdue (not finished)', result.overdue.length, 'tasks');
    result.rows.forEach((r) => add('Finished', `${r.id} ${r.name}`, r.days, 'days', `Planned ${r.plannedFinish}, actual ${r.actualFinish}`));
    result.overdue.forEach((r) => add('Overdue', `${r.id} ${r.name}`, r.days, 'days overdue', `Planned finish ${r.plannedFinish}`));
    result.excluded.forEach((e) => add('Left out', `${e.id} ${e.name}`, e.reason));
    result.caveats.forEach((c) => add('Caveat', 'Note', c));
    saveCsv(`openpm-lens-finish-${shared.statusDate}.csv`, rows);
  }

  return (
    <section aria-labelledby="sch-h">
      <h2 id="sch-h">Schedule: planned vs actual finish</h2>
      <p className="lead">Which tasks finished on time, how late the late ones were, and which open tasks are already past their planned finish. This adds to SPI and earned schedule on the Import tab.</p>
      {!shared ? <NeedsImport onGo={onGoImport} /> : (
        <>
          <p><strong>{shared.fileName}</strong>: {shared.items.length} tasks. Planned finish comes from the Finish column chosen on the Import tab.</p>
          <div className="form">
            <ColumnSelect label="Column with the ACTUAL finish date (done, resolved, closed)" headers={shared.table.headers} value={actualCol} onChange={setCol} />
          </div>
          {actualCol === null && <p className="warn">No actual-finish column chosen, so there is nothing to compare with the plan. Overdue tasks can still be found once you choose a status date.</p>}
          {!shared.statusDate && <p className="warn">Choose a status date on the Import tab to see results. It is not assumed.</p>}
          {shared.statusDate && <MilestoneSection shared={shared} actualCol={actualCol} />}
          {result && (
            <div aria-live="polite">
              <h3>Results</h3>
              <div className="grid">
                <div className="card"><h4>Finished on time</h4><p className="big">{result.onTimePercent === null ? 'Insufficient data' : `${result.onTimePercent}%`}</p><p className="note">{result.onTime} of {result.finished} finished tasks were done on or before the planned finish.</p></div>
                <div className="card"><h4>Median finish variance</h4><p className="big">{result.medianVariance === null ? 'Insufficient data' : `${result.medianVariance} days`}</p><p className="note">Positive means late. Average: {f(result.meanVariance)} days.</p></div>
                <div className="card"><h4>Worst lateness</h4><p className="big">{result.worstLate === null ? 'Not available' : `${result.worstLate} days`}</p><p className="note">Among finished tasks.</p></div>
                <div className="card"><h4>Overdue, not finished</h4><p className="big">{result.overdue.length}</p><p className="note">Planned finish is before {shared.statusDate}. Not yet due: {result.notYetDue}.</p></div>
              </div>
              {result.caveats.map((c) => <p key={c} className="warn">{c}</p>)}
              <div className="scroll" tabIndex={0}>
                <table>
                  <caption>Overdue tasks, longest first</caption>
                  <thead><tr><th scope="col">Task</th><th scope="col">Planned finish</th><th scope="col">Days overdue</th></tr></thead>
                  <tbody>
                    {result.overdue.length === 0 && <tr><td colSpan={3}>No overdue tasks.</td></tr>}
                    {result.overdue.slice(0, 50).map((r) => <tr key={r.id}><th scope="row">{r.id} {r.name !== r.id ? r.name : ''}</th><td>{r.plannedFinish}</td><td>{r.days}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div className="scroll" tabIndex={0}>
                <table>
                  <caption>Finished tasks, latest first</caption>
                  <thead><tr><th scope="col">Task</th><th scope="col">Planned finish</th><th scope="col">Actual finish</th><th scope="col">Variance (days)</th></tr></thead>
                  <tbody>
                    {result.rows.length === 0 && <tr><td colSpan={4}>No finished task has both dates.</td></tr>}
                    {[...result.rows].sort((a, b) => b.days - a.days).slice(0, 50).map((r) => <tr key={r.id}><th scope="row">{r.id} {r.name !== r.id ? r.name : ''}</th><td>{r.plannedFinish}</td><td>{r.actualFinish}</td><td>{r.days > 0 ? '▲ ' : ''}{r.days}</td></tr>)}
                  </tbody>
                </table>
              </div>
              {result.excluded.length > 0 && (
                <details><summary>Tasks left out, and why ({result.excluded.length})</summary>
                  <ul>{result.excluded.map((e) => <li key={e.id}>{e.id} {e.name !== e.id ? e.name : ''}: {e.reason}</li>)}</ul>
                </details>
              )}
              <StepsPanel title="Show the working for finish dates" assumptions={assumptions} groups={result.steps} />
              <p><button type="button" onClick={download}>Download finish-date results (CSV)</button></p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
