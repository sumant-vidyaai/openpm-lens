import { useEffect, useMemo, useState } from 'react';
import { analyseMoney, EAC_METHODS, forecastMoney, roundHalfUp, splitPeople, type CsvCell, type EacMethod, type MoneyTask } from '@openpm-lens/core';
import { ColumnSelect, NeedsImport, saveCsv, suggestAssignee } from './common';
import { StepsPanel } from './Explain';
import type { SharedData } from './shared';

const METHODS = EAC_METHODS.filter((m) => m.value !== 'cpi_spi');

export function CostScreen({ shared, onGoImport }: { shared: SharedData | null; onGoImport: () => void }) {
  const [col, setCol] = useState<string | null | undefined>(undefined);
  const [currency, setCurrency] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  const [personRates, setPersonRates] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<EacMethod>('typical');
  useEffect(() => { setCol(undefined); setPersonRates({}); }, [shared?.fileName, shared?.table]);
  const assigneeCol = col === undefined ? (shared ? suggestAssignee(shared.table.headers) : null) : col;

  const tasks: MoneyTask[] = useMemo(() => {
    if (!shared) return [];
    const idx = assigneeCol === null ? -1 : shared.table.headers.indexOf(assigneeCol);
    return shared.hoursTasks.map((t, i) => ({
      id: t.id, plannedHours: t.plannedHours, actualHours: t.actualHours, percentComplete: t.percentComplete,
      assignee: idx < 0 ? null : ((shared.table.rows[i]?.[idx] ?? '').trim() || null),
    }));
  }, [shared, assigneeCol]);
  const people = useMemo(() => [...new Set(tasks.flatMap((t) => splitPeople(t.assignee)))].sort().slice(0, 100), [tasks]);

  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const dr = num(defaultRate);
  const badDefault = dr !== null && (!Number.isFinite(dr) || dr < 0);
  const byPerson = useMemo(() => {
    const o: Record<string, number> = {};
    for (const [k, v] of Object.entries(personRates)) { const n = num(v); if (n !== null && Number.isFinite(n) && n >= 0) o[k] = n; }
    return o;
  }, [personRates]);
  const money = useMemo(() => (shared ? analyseMoney(tasks, { defaultRate: badDefault ? null : dr, byPerson }) : null), [shared, tasks, dr, badDefault, byPerson]);
  const haveRates = dr !== null || Object.keys(byPerson).length > 0;
  const fc = useMemo(() => (money && money.used > 0 ? forecastMoney(money, null, null, method) : null), [money, method]);
  const cur = currency.trim();
  const m = (n: number | null) => (n === null ? 'Not available' : `${cur ? cur + ' ' : ''}${roundHalfUp(n, 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const r4 = (n: number | null) => (n === null ? 'Not available' : String(roundHalfUp(n, 4)));
  const r2 = (n: number | null) => (n === null ? 'Not available' : String(roundHalfUp(n, 2)));
  const assumptions = [
    `File: ${shared?.fileName ?? ''}. Rates are cost per hour, entered by you${cur ? ` in ${cur}` : ''}. One currency; nothing is converted or looked up.`,
    `Default rate: ${dr === null ? 'none (tasks without their own person rate are left out)' : dr}.`,
    'A task naming several people (separated by ";") uses the default rate only if none of them has an own rate; otherwise it is left out.',
    'Same task rules as the hours version: tasks without planned hours, actual hours or % complete are left out.',
  ];

  function download() {
    if (!money || !shared) return;
    const rows: CsvCell[][] = [['Section', 'Item', 'Value', 'Unit', 'Note']];
    const add = (s: string, i: string, v: CsvCell, u = '', n = '') => rows.push([s, i, v, u, n]);
    const r4 = (n: number | null) => (n === null ? null : roundHalfUp(n, 4));
    add('Source', 'File', shared.fileName); add('Source', 'Report made on', new Date().toLocaleDateString('en-CA'), '', 'Values rounded to 4 decimal places.');
    assumptions.forEach((a) => add('Assumption', 'Setting', a));
    add('Cost in money', 'Earned value (EV)', r4(money.ev), cur); add('Cost in money', 'Actual cost (AC)', r4(money.ac), cur);
    add('Cost in money', 'Budget (BAC)', r4(money.bac), cur, 'Planned hours x rate of the tasks used');
    add('Cost in money', 'Cost performance index (CPI)', r4(money.cpi), 'ratio'); add('Cost in money', 'Cost variance (CV)', r4(money.cv), cur);
    add('Cost in money', 'Tasks used', `${money.used} of ${money.total}`);
    if (fc) {
      add('Forecast', 'Estimate at completion (EAC)', r4(fc.eac), cur); add('Forecast', 'Estimate to complete (ETC)', r4(fc.etc), cur);
      add('Forecast', 'Variance at completion (VAC)', r4(fc.vac), cur); add('Forecast', 'TCPI vs budget', r4(fc.tcpiBac), 'ratio');
    }
    money.rows.forEach((r) => add('Task', r.id, r4(r.ev), cur, `Rate ${r.rate ?? '-'}; AC ${r4(r.ac) ?? '-'}; BAC ${r4(r.bac) ?? '-'}; ${r.note}`));
    money.caveats.forEach((c) => add('Caveat', 'Note', c));
    saveCsv(`openpm-lens-cost-money-${new Date().toLocaleDateString('en-CA')}.csv`, rows);
  }

  return (
    <section aria-labelledby="cost-h">
      <h2 id="cost-h">Cost in money</h2>
      <p className="lead">Turn the hours into money using hourly rates you enter. The app never looks up or assumes a rate.</p>
      {!shared ? <NeedsImport onGo={onGoImport} /> : (
        <>
          <p><strong>{shared.fileName}</strong>: {shared.items.length} tasks.</p>
          <div className="form">
            <ColumnSelect label="Column with who the task is assigned to (optional)" headers={shared.table.headers} value={assigneeCol} onChange={setCol} />
            <label>Currency label (shown only, no conversion)<input type="text" maxLength={8} value={currency} onChange={(e) => setCurrency(e.target.value)} /></label>
            <label>Default cost per hour<input type="number" min={0} step="0.01" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} /></label>
          </div>
          {badDefault && <p className="warn" role="alert">The default rate must be a number, 0 or more. It is not used.</p>}
          {people.length > 0 && (
            <details className="explain">
              <summary>Rates for individual people ({people.length}{people.length === 100 ? ', first 100' : ''})</summary>
              <div className="form">
                {people.map((p) => (
                  <label key={p}>{p}
                    <input type="number" min={0} step="0.01" value={personRates[p] ?? ''} onChange={(e) => setPersonRates((cur) => ({ ...cur, [p]: e.target.value }))} />
                  </label>
                ))}
              </div>
            </details>
          )}
          {!haveRates && <p className="warn">Enter a default rate, or rates for people, to see money values. None is assumed.</p>}
          {money && haveRates && (money.used === 0 ? (
            <p className="warn">No task could be priced. {money.excluded[0] ? `For example ${money.excluded[0].id}: ${money.excluded[0].reason}.` : ''}</p>
          ) : (
            <div aria-live="polite">
              <h3>Results</h3>
              <div className="grid">
                <div className="card"><h4>Earned value (EV)</h4><p className="big">{m(money.ev)}</p><p className="note">Planned hours x % complete x rate.</p></div>
                <div className="card"><h4>Actual cost (AC)</h4><p className="big">{m(money.ac)}</p><p className="note">Actual hours x rate.</p></div>
                <div className="card"><h4>Cost performance (CPI)</h4><p className="big">{r2(money.cpi)}</p><p className="note">EV / AC = {r4(money.cpi)}. In hours, over the same tasks: {r4(money.hoursCpi)}.</p></div>
                <div className="card"><h4>Cost variance (CV)</h4><p className="big">{m(money.cv)}</p><p className="note">EV - AC. Negative means over budget.</p></div>
                <div className="card"><h4>Budget (BAC)</h4><p className="big">{m(money.bac)}</p><p className="note">Planned hours x rate, of the tasks used ({money.used} of {money.total}).</p></div>
              </div>
              {money.caveats.map((c) => <p key={c} className="warn">{c}</p>)}
              {fc && (
                <>
                  <h3>Forecast in money</h3>
                  <label className="form">How do you expect the rest of the work to go?
                    <select value={method} onChange={(e) => setMethod(e.target.value as EacMethod)}>{METHODS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select>
                  </label>
                  <div className="grid">
                    <div className="card"><h4>Estimate at completion (EAC)</h4><p className="big">{m(fc.eac)}</p></div>
                    <div className="card"><h4>Estimate to complete (ETC)</h4><p className="big">{m(fc.etc)}</p></div>
                    <div className="card"><h4>Variance at completion (VAC)</h4><p className="big">{m(fc.vac)}</p><p className="note">Negative means a forecast overrun.</p></div>
                    <div className="card"><h4>To-complete index (TCPI)</h4><p className="big">{r2(fc.tcpiBac)}</p></div>
                  </div>
                  {fc.reasons.map((r) => <p key={r} className="warn">{r}</p>)}
                  <p className="note">The method that also uses schedule performance is not offered here, because planned value is not priced.</p>
                </>
              )}
              {money.excluded.length > 0 && (
                <details><summary>Tasks left out, and why ({money.excluded.length})</summary>
                  <ul>{money.excluded.map((e) => <li key={e.id}>{e.id}: {e.reason}</li>)}</ul>
                </details>
              )}
              <StepsPanel title="Show the working for cost in money" assumptions={assumptions} groups={[...money.steps, ...(fc?.steps ?? [])]} />
              <p><button type="button" onClick={download}>Download cost-in-money results (CSV)</button></p>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
