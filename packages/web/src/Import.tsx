import { useMemo, useState } from 'react';
import {
  IMPORT_FIELDS, aggregateHoursEvm, buildWorkItems, costPerformanceIndex, costVariance,
  distinctStatuses, parseCsv, roundHalfUp, suggestMapping, suggestStatusCategory, toHoursTasks,
  type ColumnMapping, type ImportField, type MissingPlannedPolicy, type PercentRule,
  type StatusCategory, type StatusMap, type Unit,
} from '@openpm-lens/core';
import { SAMPLE_CSV } from './sample';

const CATEGORY_LABEL: Record<StatusCategory | 'unmapped', string> = {
  not_started: 'Not started', in_progress: 'In progress', done: 'Done', cancelled: 'Cancelled',
  unmapped: 'Not sure (leave out)',
};

const RULES: { value: PercentRule; label: string }[] = [
  { value: 'tool_reported', label: 'Use the % complete in my file' },
  { value: 'zero_hundred', label: '0/100: nothing until done, then 100%' },
  { value: 'fifty_fifty', label: '50/50: half credit while in progress' },
  { value: 'status_based', label: 'Status-based: I choose the % for in progress' },
];

export function ImportScreen() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [mappingEdits, setMappingEdits] = useState<Partial<ColumnMapping>>({});
  const [statusEdits, setStatusEdits] = useState<StatusMap>({});
  const [defaultUnit, setDefaultUnit] = useState<Unit>('hours');
  const [percentScale, setPercentScale] = useState<'0-100' | '0-1'>('0-100');
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [rule, setRule] = useState<PercentRule>('tool_reported');
  const [inProgressPercent, setInProgressPercent] = useState(50);
  const [missingPlanned, setMissingPlanned] = useState<MissingPlannedPolicy>('exclude');

  const csv = useMemo(() => (text === null ? null : parseCsv(text)), [text]);
  const mapping: ColumnMapping | null = useMemo(
    () => (csv ? { ...suggestMapping(csv.headers), ...mappingEdits } : null),
    [csv, mappingEdits],
  );
  const statuses = useMemo(
    () => (csv && mapping ? distinctStatuses(csv.headers, csv.rows, mapping) : []),
    [csv, mapping],
  );
  const statusMap: StatusMap = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s, statusEdits[s] ?? suggestStatusCategory(s)])),
    [statuses, statusEdits],
  );

  const result = useMemo(() => {
    if (!csv || !mapping || mapping.name === null) return null;
    const items = buildWorkItems(csv.headers, csv.rows, mapping, { defaultUnit, percentScale, statusMap });
    const calendar = { hoursPerDay, daysPerWeek: 5 };
    const config = rule === 'status_based' ? { inProgressPercent } : undefined;
    return aggregateHoursEvm(toHoursTasks(items, calendar, rule, config), missingPlanned);
  }, [csv, mapping, defaultUnit, percentScale, statusMap, hoursPerDay, rule, inProgressPercent, missingPlanned]);

  function load(name: string, content: string) {
    setFileName(name); setText(content); setMappingEdits({}); setStatusEdits({});
  }

  const fmt = (n: number | null, d = 2) => (n === null ? 'Not available' : String(roundHalfUp(n, d)));
  const cpi = result && result.ev !== null && result.ac !== null ? costPerformanceIndex(result.ev, result.ac) : null;
  const cv = result && result.ev !== null && result.ac !== null ? costVariance(result.ev, result.ac) : null;

  return (
    <section aria-labelledby="import-h">
      <h2 id="import-h">Import your tasks</h2>
      <p className="lead">
        Choose a CSV export from your tool. The file is read in this browser tab only. It is never uploaded.
      </p>
      <div className="row">
        <label className="btn">
          Choose CSV file{' '}
          <input
            type="file" accept=".csv,text/csv,.txt"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) load(f.name, await f.text());
            }}
          />
        </label>
        <button type="button" onClick={() => load('sample.csv (made-up example)', SAMPLE_CSV)}>
          Try the made-up example
        </button>
      </div>

      {csv && mapping && (
        <>
          <p>
            <strong>{fileName}</strong>: {csv.rows.length} rows, {csv.headers.length} columns.
          </p>
          {csv.warnings.map((w) => <p key={w} className="warn">{w}</p>)}

          <h3>1. Which column is which?</h3>
          <p className="note">We guessed from the column names. Please check each one.</p>
          <div className="form">
            {IMPORT_FIELDS.map(({ field, label, required }) => (
              <label key={field}>
                {label}{required ? ' (required)' : ''}
                <select
                  value={mapping[field] ?? ''}
                  onChange={(e) => setMappingEdits((m) => ({ ...m, [field as ImportField]: e.target.value === '' ? null : e.target.value }))}
                >
                  <option value="">Not in my file</option>
                  {csv.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          {mapping.name === null && <p className="warn">Pick the Task name column to continue.</p>}

          <h3>2. Units and assumptions</h3>
          <div className="form">
            <label>
              Effort numbers without a unit are in
              <select value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value as Unit)}>
                <option value="hours">hours</option>
                <option value="days">days</option>
                <option value="minutes">minutes</option>
                <option value="weeks">weeks</option>
              </select>
            </label>
            <label>
              Hours in one working day
              <input type="number" min={1} max={24} step={0.5} value={hoursPerDay}
                onChange={(e) => setHoursPerDay(Number(e.target.value) || 8)} />
            </label>
            <label>
              % complete column is written as
              <select value={percentScale} onChange={(e) => setPercentScale(e.target.value as '0-100' | '0-1')}>
                <option value="0-100">0 to 100 (for example 40)</option>
                <option value="0-1">0 to 1 (for example 0.4)</option>
              </select>
            </label>
            <label>
              How is progress measured?
              <select value={rule} onChange={(e) => setRule(e.target.value as PercentRule)}>
                {RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            {rule === 'status_based' && (
              <label>
                % credited while in progress
                <input type="number" min={0} max={100} value={inProgressPercent}
                  onChange={(e) => setInProgressPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
              </label>
            )}
            <label>
              Tasks with no planned effort
              <select value={missingPlanned} onChange={(e) => setMissingPlanned(e.target.value as MissingPlannedPolicy)}>
                <option value="exclude">Leave out and tell me (recommended)</option>
                <option value="treat_as_zero">Count planned as 0 (worst case, flagged)</option>
              </select>
            </label>
          </div>

          {statuses.length > 0 && rule !== 'tool_reported' && (
            <>
              <h3>3. What does each status mean?</h3>
              <div className="form">
                {statuses.map((s) => (
                  <label key={s}>
                    {s}
                    <select value={statusMap[s]} onChange={(e) => setStatusEdits((m) => ({ ...m, [s]: e.target.value as StatusCategory | 'unmapped' }))}>
                      {(Object.keys(CATEGORY_LABEL) as (StatusCategory | 'unmapped')[]).map((k) => (
                        <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </>
          )}

          {result && (
            <div aria-live="polite">
              <h3>Results (in hours)</h3>
              {result.status === 'not_available' ? (
                <p className="warn">Not available. Missing: {result.missing.join(', ')}.</p>
              ) : (
                <div className="grid">
                  <div className="card"><h4>Earned value (EV)</h4><p className="big">{fmt(result.ev)}</p><p className="note">Planned hours x % complete, added up.</p></div>
                  <div className="card"><h4>Actual cost (AC)</h4><p className="big">{fmt(result.ac)}</p><p className="note">Hours actually spent.</p></div>
                  <div className="card"><h4>Cost performance (CPI)</h4><p className="big">{fmt(cpi)}</p><p className="note">EV / AC. Below 1 means more hours spent than the work earned.</p></div>
                  <div className="card"><h4>Cost variance (CV)</h4><p className="big">{fmt(cv)}</p><p className="note">EV - AC. Negative means over budget.</p></div>
                  <div className="card"><h4>Schedule performance (SPI)</h4><p className="big">Not available</p><p className="note">Needs planned dates (planned value). Not in this file.</p></div>
                </div>
              )}
              <p>
                <strong>{result.counts.used} of {result.counts.total}</strong> tasks used.
                {' '}Progress rule: {RULES.find((r) => r.value === rule)?.label}.
              </p>
              {result.caveats.map((c) => <p key={c} className="warn">{c}</p>)}
              {result.excluded.length > 0 && (
                <details>
                  <summary>Which tasks were left out, and why</summary>
                  <ul>{result.excluded.map((e) => <li key={e.id}>{e.id}: {e.reason}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
