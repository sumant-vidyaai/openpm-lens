import { useEffect, useMemo, useState } from 'react';
import { analyseDefects, MIN_FLOW_SAMPLE, parseDateText, roundHalfUp, suggestFlowColumns, type CsvCell, type DefectItem } from '@openpm-lens/core';
import { ColumnSelect, NeedsImport, saveCsv } from './common';
import { StepsPanel } from './Explain';
import type { SharedData } from './shared';

const guess = (headers: string[], res: RegExp[]) => {
  for (const re of res) { const hit = headers.find((h) => re.test(h.trim())); if (hit) return hit; }
  return null;
};
const MAX_VALUES = 30;

export function QualityScreen({ shared, onGoImport }: { shared: SharedData | null; onGoImport: () => void }) {
  type Picks = { type?: string | null; severity?: string | null; created?: string | null; resolved?: string | null; found?: string | null };
  const [picks, setPicks] = useState<Picks>({});
  const [defectVals, setDefectVals] = useState<Set<string> | null>(null);
  const [afterVals, setAfterVals] = useState<Set<string>>(new Set());
  useEffect(() => { setPicks({}); setDefectVals(null); setAfterVals(new Set()); }, [shared?.fileName, shared?.table]);

  const headers = shared?.table.headers ?? [];
  const col = {
    type: picks.type !== undefined ? picks.type : guess(headers, [/^(issue |work item |item )?type$/i, /type|kind|category/i]),
    severity: picks.severity !== undefined ? picks.severity : guess(headers, [/^severity$/i, /severity/i]),
    created: picks.created !== undefined ? picks.created : guess(headers, [/^(date )?(created|opened|reported|raised)( date)?$/i, /created|opened|reported|raised/i]),
    resolved: picks.resolved !== undefined ? picks.resolved : suggestFlowColumns(headers).done,
    found: picks.found !== undefined ? picks.found : null,
  };
  const idx = (c: string | null) => (c === null ? -1 : headers.indexOf(c));
  const cell = (i: number, j: number) => (j < 0 ? '' : (shared?.table.rows[i]?.[j] ?? '').trim());

  const distinct = (c: string | null): string[] => {
    if (!shared || c === null) return [];
    const j = idx(c);
    return [...new Set(shared.table.rows.map((_, i) => cell(i, j)).filter((v) => v !== ''))].sort();
  };
  const typeValues = useMemo(() => distinct(col.type), [shared, col.type]); // eslint-disable-line react-hooks/exhaustive-deps
  const foundValues = useMemo(() => distinct(col.found), [shared, col.found]); // eslint-disable-line react-hooks/exhaustive-deps
  const defaultDefects = useMemo(() => new Set(typeValues.filter((v) => /bug|defect|incident|problem/i.test(v))), [typeValues]);
  const defectSet = defectVals ?? defaultDefects;

  const usesFound = col.found !== null && afterVals.size > 0;
  const result = useMemo(() => {
    if (!shared || !shared.statusDate || col.type === null) return null;
    const [jT, jS, jC, jR, jF] = [idx(col.type), idx(col.severity), idx(col.created), idx(col.resolved), idx(col.found)];
    const items: DefectItem[] = shared.items.map((it, i) => {
      const type = cell(i, jT);
      const issues: DefectItem['issues'] = [];
      const read = (j: number, field: string): string | null => {
        const t = cell(i, j);
        if (t === '') return null;
        const d = parseDateText(t, shared.dateOrder, field);
        if (d.issue) issues.push(d.issue);
        return d.iso;
      };
      const created = read(jC, 'createdAt');
      const resolved = read(jR, 'resolvedAt');
      const found = cell(i, jF);
      return {
        id: it.id, name: it.name, isDefect: type === '' ? null : defectSet.has(type), severity: cell(i, jS) || null, created, resolved,
        closedByStatus: it.statusCategory === 'done', cancelled: it.statusCategory === 'cancelled',
        foundAfterRelease: !usesFound || found === '' ? null : afterVals.has(found), issues,
      };
    });
    return analyseDefects(items, shared.statusDate, usesFound);
  }, [shared, col.type, col.severity, col.created, col.resolved, col.found, defectSet, afterVals, usesFound]); // eslint-disable-line react-hooks/exhaustive-deps

  const assumptions = shared ? [
    `File: ${shared.fileName}. Status date: ${shared.statusDate || 'not chosen'}. Defects = items whose type you ticked: ${[...defectSet].join(', ') || 'none'}.`,
    'Open = not resolved by the status date (a task marked done with no date counts as closed). Age and resolution time count days from created, including both days (same day = 1).',
    `Percentages and percentiles need at least ${MIN_FLOW_SAMPLE} items, otherwise they say "Insufficient data". Percentiles use the nearest-rank method.`,
    'These measures have no single standard; the rules above are this app\'s own. Defect density needs code size, which project exports rarely have, so it is not offered.',
    `Date order: ${shared.dateOrder === 'auto' ? 'unclear dates are refused' : shared.dateOrder === 'dmy' ? 'day / month / year' : 'month / day / year'}.`,
  ] : [];
  const f = (n: number | null, d = 1) => (n === null ? 'Not available' : String(roundHalfUp(n, d)));
  const toggle = (set: Set<string>, v: string): Set<string> => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); return n; };

  function download() {
    if (!result || !shared) return;
    const rows: CsvCell[][] = [['Section', 'Item', 'Value', 'Unit', 'Note']];
    const add = (s: string, i: string, v: CsvCell, u = '', n = '') => rows.push([s, i, v, u, n]);
    const r4 = (n: number | null) => (n === null ? null : roundHalfUp(n, 4));
    add('Source', 'File', shared.fileName); add('Source', 'Status date', shared.statusDate);
    add('Source', 'Report made on', new Date().toLocaleDateString('en-CA'), '', 'Values rounded to 4 decimal places.');
    assumptions.forEach((a) => add('Assumption', 'Setting', a));
    add('Defects', 'Defects counted', result.defects); add('Defects', 'Open', result.open); add('Defects', 'Closed', result.closed);
    add('Defects', 'Defect share', result.sharePercent ?? 'Insufficient data', result.sharePercent === null ? '' : '%', 'Defects / (defects + other items)');
    add('Defects', 'Open defect age, mean', r4(result.openAgeMean), 'days'); add('Defects', 'Open defect age, median', result.openAgeMedian ?? 'Insufficient data', result.openAgeMedian === null ? '' : 'days');
    if (result.resolution) {
      add('Defects', 'Resolution time, mean', r4(result.resolution.mean), 'days'); add('Defects', 'Resolution time, median', result.resolution.median ?? 'Insufficient data', result.resolution.median === null ? '' : 'days');
      add('Defects', 'Resolution time, 85th percentile', result.resolution.p85 ?? 'Insufficient data', result.resolution.p85 === null ? '' : 'days');
    }
    if (result.removal) add('Defects', 'Removal efficiency', result.removal.percent ?? 'Insufficient data', result.removal.percent === null ? '' : '%', `${result.removal.before} before release, ${result.removal.after} after`);
    result.bySeverity.forEach((s) => add('Severity', s.severity, s.total, 'defects', `${s.open} open, ${s.closed} closed`));
    result.openList.forEach((o) => add('Open defect', `${o.id} ${o.name}`, o.age, 'days', `${o.severity}; created ${o.created ?? 'unknown'}`));
    result.excluded.forEach((e) => add('Left out', `${e.id} ${e.name}`, e.reason));
    result.caveats.forEach((c) => add('Caveat', 'Note', c));
    saveCsv(`openpm-lens-quality-${shared.statusDate}.csv`, rows);
  }

  const pick = (k: keyof Picks) => (v: string | null) => setPicks((p) => ({ ...p, [k]: v }));
  return (
    <section aria-labelledby="q-h">
      <h2 id="q-h">Quality: defects</h2>
      <p className="lead">How many defects there are, how long open ones have been open, how fast defects get resolved, and how they split by severity. You choose which item types count as defects.</p>
      {!shared ? <NeedsImport onGo={onGoImport} /> : (
        <>
          <p><strong>{shared.fileName}</strong>: {shared.items.length} items.</p>
          <h3>1. Which column is which?</h3>
          <div className="form">
            <ColumnSelect label="Item type (bug, story, task...)" headers={headers} value={col.type} onChange={pick('type')} none="Choose a column..." />
            <ColumnSelect label="Severity or priority (optional)" headers={headers} value={col.severity} onChange={pick('severity')} />
            <ColumnSelect label="Date created or reported" headers={headers} value={col.created} onChange={pick('created')} />
            <ColumnSelect label="Date resolved or closed" headers={headers} value={col.resolved} onChange={pick('resolved')} />
            <ColumnSelect label="Where it was found (optional, for removal efficiency)" headers={headers} value={col.found} onChange={pick('found')} />
          </div>
          {col.type === null && <p className="warn">Choose the column that says what kind of item each row is. Without it, defects cannot be told from other work.</p>}
          {typeValues.length > 0 && (
            <fieldset className="card">
              <legend>2. Which types are defects?</legend>
              <p className="note">We ticked names that look like defects. Change this to match your tool.</p>
              <div className="row">
                {typeValues.slice(0, MAX_VALUES).map((v) => (
                  <label key={v}><input type="checkbox" checked={defectSet.has(v)} onChange={() => setDefectVals(toggle(defectSet, v))} /> {v}</label>
                ))}
              </div>
              {typeValues.length > MAX_VALUES && <p className="warn">The file has {typeValues.length} different types; only the first {MAX_VALUES} are listed.</p>}
            </fieldset>
          )}
          {col.found !== null && foundValues.length > 0 && (
            <fieldset className="card">
              <legend>Which values mean "found after release"?</legend>
              <p className="note">Nothing is ticked for you. Tick the values that mean the defect was found after the release (for example production). Until you tick at least one, removal efficiency is not worked out.</p>
              <div className="row">
                {foundValues.slice(0, MAX_VALUES).map((v) => (
                  <label key={v}><input type="checkbox" checked={afterVals.has(v)} onChange={() => setAfterVals(toggle(afterVals, v))} /> {v}</label>
                ))}
              </div>
            </fieldset>
          )}
          {!shared.statusDate && <p className="warn">Choose a status date on the Import tab to see results. It is not assumed.</p>}
          {result && (
            <div aria-live="polite">
              <h3>Results</h3>
              <div className="grid">
                <div className="card"><h4>Defects</h4><p className="big">{result.defects}</p><p className="note">{result.open} open and {result.closed} closed at {shared.statusDate}.</p></div>
                <div className="card"><h4>Defect share</h4><p className="big">{result.sharePercent === null ? 'Insufficient data' : `${result.sharePercent}%`}</p><p className="note">Defects among {result.defects + result.otherItems} items ({result.otherItems} other).</p></div>
                <div className="card"><h4>Open defect age</h4><p className="big">{result.openList.find((o) => o.age !== null)?.age ?? 'Not available'}{result.openList.find((o) => o.age !== null) ? ' days' : ''}</p><p className="note">Oldest open defect. Average {f(result.openAgeMean)} days{result.openAgeMedian === null ? '' : `; median ${result.openAgeMedian}`}.</p></div>
                <div className="card"><h4>Resolution time, typical</h4><p className="big">{result.resolution === null ? 'Not available' : result.resolution.median === null ? 'Insufficient data' : `${result.resolution.median} days`}</p><p className="note">{result.resolution ? `Average ${f(result.resolution.mean)} days over ${result.resolution.n} resolved defects${result.resolution.p85 === null ? '' : `; 85th percentile ${result.resolution.p85}`}.` : 'No resolved defect has both dates.'}</p></div>
                {result.removal && <div className="card"><h4>Removal efficiency</h4><p className="big">{result.removal.percent === null ? 'Insufficient data' : `${result.removal.percent}%`}</p><p className="note">{result.removal.before} found before release, {result.removal.after} after.</p></div>}
              </div>
              {col.found !== null && afterVals.size === 0 && <p className="warn">Tick at least one "found after release" value above to work out removal efficiency.</p>}
              {result.caveats.map((c) => <p key={c} className="warn">{c}</p>)}
              <div className="scroll">
                <table>
                  <caption>Defects by severity</caption>
                  <thead><tr><th scope="col">Severity</th><th scope="col">Defects</th><th scope="col">Open</th><th scope="col">Closed</th></tr></thead>
                  <tbody>
                    {result.bySeverity.length === 0 && <tr><td colSpan={4}>No defects.</td></tr>}
                    {result.bySeverity.map((s) => <tr key={s.severity}><th scope="row">{s.severity}</th><td>{s.total}</td><td>{s.open}</td><td>{s.closed}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div className="scroll">
                <table>
                  <caption>Open defects, oldest first</caption>
                  <thead><tr><th scope="col">Defect</th><th scope="col">Severity</th><th scope="col">Created</th><th scope="col">Age (days)</th></tr></thead>
                  <tbody>
                    {result.openList.length === 0 && <tr><td colSpan={4}>No open defects.</td></tr>}
                    {result.openList.slice(0, 50).map((o) => <tr key={o.id}><th scope="row">{o.id} {o.name !== o.id ? o.name : ''}</th><td>{o.severity}</td><td>{o.created ?? 'unknown'}</td><td>{o.age ?? 'n/a'}</td></tr>)}
                  </tbody>
                </table>
              </div>
              {result.excluded.length > 0 && (
                <details><summary>Items left out, and why ({result.excluded.length})</summary>
                  <ul>{result.excluded.map((e) => <li key={e.id}>{e.id} {e.name !== e.id ? e.name : ''}: {e.reason}</li>)}</ul>
                </details>
              )}
              <StepsPanel title="Show the working for quality" assumptions={assumptions} groups={result.steps} />
              <p><button type="button" onClick={download}>Download quality results (CSV)</button></p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
