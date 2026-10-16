import { useEffect, useMemo, useState } from 'react';
import { analyseResources, roundHalfUp, type CsvCell, type ResourceTask } from '@openpm-lens/core';
import { ColumnSelect, NeedsImport, saveCsv, suggestAssignee } from './common';
import { StepsPanel } from './Explain';
import type { SharedData } from './shared';

export function ResourceScreen({ shared, onGoImport }: { shared: SharedData | null; onGoImport: () => void }) {
  const [col, setCol] = useState<string | null | undefined>(undefined);
  const [capacity, setCapacity] = useState('40');
  const [over, setOver] = useState('100');
  const [own, setOwn] = useState<Record<string, string>>({});
  useEffect(() => { setCol(undefined); setOwn({}); }, [shared?.fileName, shared?.table]);
  useEffect(() => {
    const c = shared?.template?.settings?.capacity;
    setCapacity(c != null ? String(c) : '40');
  }, [shared?.fileName, shared?.table]); // eslint-disable-line react-hooks/exhaustive-deps
  const assigneeCol = col === undefined ? (shared ? suggestAssignee(shared.table.headers) : null) : col;

  const tasks: ResourceTask[] = useMemo(() => {
    if (!shared || assigneeCol === null) return [];
    const idx = shared.table.headers.indexOf(assigneeCol);
    return shared.items.map((it, i) => ({
      id: it.id, assignee: ((shared.table.rows[i]?.[idx] ?? '').trim() || null),
      plannedHours: shared.hoursTasks[i]?.plannedHours ?? null, actualHours: shared.hoursTasks[i]?.actualHours ?? null,
      plannedStart: it.baselineStart, plannedFinish: it.baselineFinish,
    }));
  }, [shared, assigneeCol]);

  const cap = Number(capacity), ov = Number(over);
  const capOk = capacity.trim() !== '' && Number.isFinite(cap) && cap > 0;
  const ovOk = over.trim() !== '' && Number.isFinite(ov) && ov > 0;
  const capByPerson = useMemo(() => {
    const o: Record<string, number> = {};
    for (const [k, v] of Object.entries(own)) { const n = Number(v); if (v.trim() !== '' && Number.isFinite(n) && n > 0) o[k] = n; }
    return o;
  }, [own]);
  const result = useMemo(
    () => (shared && assigneeCol !== null && capOk && ovOk ? analyseResources(tasks, { capacityDefault: cap, capacityByPerson: capByPerson, mode: shared.dayCount, overPercent: ov }) : null),
    [shared, assigneeCol, tasks, cap, ov, capOk, ovOk, capByPerson],
  );
  const pct = (n: number | null) => (n === null ? '-' : `${roundHalfUp(n, 0)}%`);
  const assumptions = [
    `File: ${shared?.fileName ?? ''}. Weekly capacity: ${capacity} hours per person unless set for a person. A week is flagged above ${over}%.`,
    `Planned hours are spread evenly over each task's planned ${shared?.dayCount === 'calendar' ? 'calendar days' : 'weekdays (holidays and leave not known)'}; weeks start on Monday.`,
    'A task naming several people (separated by ";") is left out, because how the hours split is not known. Tasks with nobody assigned are shown on their own row.',
    'These are this app\'s own arithmetic rules, not a standard.',
  ];

  function download() {
    if (!result || !shared) return;
    const rows: CsvCell[][] = [['Person', 'Capacity (h/week)', 'Tasks', 'Planned hours', 'Actual vs planned', 'Weeks over limit', 'Peak utilisation %', ...result.weeks.map((w) => `Week of ${w} (planned h)`), ...result.weeks.map((w) => `Week of ${w} (utilisation %)`)]];
    for (const p of result.people) {
      rows.push([p.person, p.capacity, p.tasks, roundHalfUp(p.plannedTotal, 4), p.actualVsPlanned === null ? null : roundHalfUp(p.actualVsPlanned, 4), p.overWeeks, p.peak === null ? null : roundHalfUp(p.peak, 2),
        ...p.weeks.map((w) => roundHalfUp(w.planned, 4)), ...p.weeks.map((w) => (w.utilisation === null ? null : roundHalfUp(w.utilisation, 2)))]);
    }
    rows.push([]);
    assumptions.forEach((a) => rows.push(['Assumption', a]));
    result.excluded.forEach((e) => rows.push(['Left out', e.id, e.reason]));
    rows.push(['Report made on', new Date().toLocaleDateString('en-CA'), 'Values rounded to 4 decimal places.']);
    saveCsv(`openpm-lens-resources-${new Date().toLocaleDateString('en-CA')}.csv`, rows);
  }

  return (
    <section aria-labelledby="res-h">
      <h2 id="res-h">Resources: workload per person</h2>
      <p className="lead">How much planned work each person has in each week, against the hours they can work. Capacity is entered by you.</p>
      {!shared ? <NeedsImport onGo={onGoImport} /> : (
        <>
          <p><strong>{shared.fileName}</strong>: {shared.items.length} tasks. Planned hours and dates come from the Import tab.</p>
          <div className="form">
            <ColumnSelect label="Column with who the task is assigned to" headers={shared.table.headers} value={assigneeCol} onChange={setCol} none="Choose a column..." />
            <label>Hours one person can work in a week<input type="number" min={1} step="0.5" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
            <label>Flag a week above (% of capacity)<input type="number" min={1} step="1" value={over} onChange={(e) => setOver(e.target.value)} /></label>
          </div>
          {assigneeCol === null && <p className="warn">Choose the column that says who each task is assigned to. Without it there is no workload per person.</p>}
          {(!capOk || !ovOk) && <p className="warn" role="alert">Capacity and the flag limit must be numbers above 0.</p>}
          {result && result.people.length > 0 && (
            <details className="explain">
              <summary>Own weekly capacity for a person (part-time, for example)</summary>
              <div className="form">
                {result.people.filter((p) => p.person !== '(unassigned)').slice(0, 100).map((p) => (
                  <label key={p.person}>{p.person}
                    <input type="number" min={1} step="0.5" placeholder={String(cap)} value={own[p.person] ?? ''} onChange={(e) => setOwn((c) => ({ ...c, [p.person]: e.target.value }))} />
                  </label>
                ))}
              </div>
            </details>
          )}
          {result && (
            <div aria-live="polite">
              <h3>Results</h3>
              {result.people.length === 0 ? <p className="warn">No tasks could be read.</p> : (
                <>
                  <div className="scroll">
                    <table>
                      <caption>Utilisation by week (planned hours / capacity). ▲ = above {over}%</caption>
                      <thead><tr><th scope="col">Person</th><th scope="col">Capacity</th>{result.weeks.map((w) => <th scope="col" key={w}>{w}</th>)}<th scope="col">Weeks over</th></tr></thead>
                      <tbody>
                        {result.people.map((p) => (
                          <tr key={p.person}>
                            <th scope="row">{p.person}</th><td>{p.capacity} h</td>
                            {p.weeks.map((w) => {
                              const flagged = w.utilisation !== null && w.utilisation > ov + 1e-9;
                              return <td key={w.weekStart} className={flagged ? 'rag-red' : undefined}>{flagged ? '▲ ' : ''}{pct(w.utilisation)}</td>;
                            })}
                            <td>{p.overWeeks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="scroll">
                    <table>
                      <caption>Totals per person</caption>
                      <thead><tr><th scope="col">Person</th><th scope="col">Tasks</th><th scope="col">Planned hours</th><th scope="col">Actual vs planned</th><th scope="col">Peak week</th></tr></thead>
                      <tbody>
                        {result.people.map((p) => (
                          <tr key={p.person}>
                            <th scope="row">{p.person}</th><td>{p.tasks}</td><td>{roundHalfUp(p.plannedTotal, 1)}</td>
                            <td>{p.actualVsPlanned === null ? 'n/a' : `${pct(p.actualVsPlanned * 100)} (${roundHalfUp(p.actualTotal, 1)} of ${roundHalfUp(p.plannedForActual, 1)} h)`}</td>
                            <td>{pct(p.peak)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {result.caveats.map((c) => <p key={c} className="warn">{c}</p>)}
              {result.excluded.length > 0 && (
                <details><summary>Tasks left out, and why ({result.excluded.length})</summary>
                  <ul>{result.excluded.map((e, i) => <li key={`${e.id}-${i}`}>{e.id}: {e.reason}</li>)}</ul>
                </details>
              )}
              <StepsPanel title="Show the working for workload" assumptions={assumptions} groups={result.steps} />
              <p><button type="button" onClick={download}>Download workload (CSV)</button></p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
