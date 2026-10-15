import { useEffect, useMemo, useState } from 'react';
import {
  IMPORT_FIELDS, aggregateHoursEvm, buildWorkItems, costPerformanceIndex, costVariance,
  distinctStatuses, parseCsv, roundHalfUp, suggestMapping, suggestStatusCategory, toHoursTasks,
  aggregateSchedule, assessQuality, detectTableAdapter, toScheduleTasks, type DateOrder, type DayCount, issueLabel, tableFromGrid, type ColumnMapping, type ImportField, type MissingPlannedPolicy, type PercentRule,
  type StatusCategory, type StatusMap, type Unit,
} from '@openpm-lens/core';
import readXlsxFile from 'read-excel-file/browser';
import { SAMPLE_CSV } from './sample';

type Grid = (string | number | boolean | Date | null)[][];
type Raw =
  | { kind: 'csv'; text: string }
  | { kind: 'xlsx'; sheets: { name: string; data: Grid }[] };

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
  const [raw, setRaw] = useState<Raw | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mappingEdits, setMappingEdits] = useState<Partial<ColumnMapping>>({});
  const [statusEdits, setStatusEdits] = useState<StatusMap>({});
  const [defaultUnit, setDefaultUnit] = useState<Unit | ''>('hours');
  const [percentScale, setPercentScale] = useState<'0-100' | '0-1'>('0-100');
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [rule, setRule] = useState<PercentRule>('tool_reported');
  const [inProgressPercent, setInProgressPercent] = useState(50);
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto');
  const [dayCount, setDayCount] = useState<DayCount>('weekdays');
  const [statusDate, setStatusDate] = useState('');
  const [missingPlanned, setMissingPlanned] = useState<MissingPlannedPolicy>('exclude');

  const csv = useMemo(() => {
    if (raw === null) return null;
    if (raw.kind === 'csv') return parseCsv(raw.text);
    return tableFromGrid(raw.sheets[sheetIdx]?.data ?? []);
  }, [raw, sheetIdx]);
  const adapter = useMemo(() => (csv ? detectTableAdapter(csv.headers) : null), [csv]);
  const suggestion = useMemo(() => (csv && adapter ? adapter.suggest(csv.headers) : null), [csv, adapter]);
  // When a known tool's file is recognised, start from its settings. The user can change everything.
  useEffect(() => {
    if (suggestion?.defaultUnit) setDefaultUnit(suggestion.defaultUnit);
    else if (suggestion) setDefaultUnit(''); // unit unknown for this tool: the user must choose
    if (suggestion?.suggestedRule) setRule(suggestion.suggestedRule);
  }, [suggestion]);
  const mapping: ColumnMapping | null = useMemo(
    () => (csv ? { ...(suggestion?.mapping ?? suggestMapping(csv.headers)), ...mappingEdits } : null),
    [csv, suggestion, mappingEdits],
  );
  const statuses = useMemo(
    () => (csv && mapping ? distinctStatuses(csv.headers, csv.rows, mapping) : []),
    [csv, mapping],
  );
  const statusMap: StatusMap = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s, statusEdits[s] ?? suggestStatusCategory(s)])),
    [statuses, statusEdits],
  );

  const calc = useMemo(() => {
    if (!csv || !mapping || mapping.name === null || defaultUnit === '') return null;
    const items = buildWorkItems(csv.headers, csv.rows, mapping, { defaultUnit, percentScale, statusMap, dateOrder });
    const calendar = { hoursPerDay, daysPerWeek: 5 };
    const config = rule === 'status_based' ? { inProgressPercent } : undefined;
    const tasks = toHoursTasks(items, calendar, rule, config);
    const agg = aggregateHoursEvm(tasks, missingPlanned);
    const schedule = statusDate
      ? aggregateSchedule(toScheduleTasks(items, calendar, rule, config), statusDate, dayCount)
      : null;
    return { agg, schedule, quality: assessQuality(items, tasks, agg) };
  }, [csv, mapping, defaultUnit, percentScale, statusMap, hoursPerDay, rule, inProgressPercent, missingPlanned, dateOrder, dayCount, statusDate]);

  const result = calc?.agg ?? null;
  const quality = calc?.quality ?? null;
  const schedule = calc?.schedule ?? null;

  function reset(name: string, next: Raw) {
    setFileName(name); setRaw(next); setSheetIdx(0); setLoadError(null); setDefaultUnit('hours'); setRule('tool_reported'); setMappingEdits({}); setStatusEdits({});
  }
  async function onFile(f: File) {
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const sheets = await readXlsxFile(f);
        if (sheets.length === 0) throw new Error('The workbook has no sheets.');
        reset(f.name, { kind: 'xlsx', sheets: sheets.map((s) => ({ name: s.sheet, data: s.data as Grid })) });
      } else if (/\.xls$/i.test(f.name)) {
        throw new Error('Old .xls files are not supported. In Excel choose Save As, then .xlsx or CSV.');
      } else {
        reset(f.name, { kind: 'csv', text: await f.text() });
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'This file could not be read.');
    }
  }

  const fmt = (n: number | null, d = 2) => (n === null ? 'Not available' : String(roundHalfUp(n, d)));
  const cpi = result && result.ev !== null && result.ac !== null ? costPerformanceIndex(result.ev, result.ac) : null;
  const cv = result && result.ev !== null && result.ac !== null ? costVariance(result.ev, result.ac) : null;

  return (
    <section aria-labelledby="import-h">
      <h2 id="import-h">Import your tasks</h2>
      <p className="lead">
        Choose a CSV or Excel (.xlsx) export from your tool. The file is read in this browser tab only. It is never uploaded.
      </p>
      <div className="row">
        <label className="btn">
          Choose file{' '}
          <input
            type="file" accept=".csv,text/csv,.txt,.xlsx"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onFile(f);
            }}
          />
        </label>
        <button type="button" onClick={() => reset('sample.csv (made-up example)', { kind: 'csv', text: SAMPLE_CSV })}>
          Try the made-up example
        </button>
      </div>

      {loadError && <p className="warn" role="alert">{loadError}</p>}
      {csv && mapping && (
        <>
          {raw?.kind === 'xlsx' && raw.sheets.length > 1 && (
            <label className="form">
              Which sheet?
              <select value={sheetIdx} onChange={(e) => { setSheetIdx(Number(e.target.value)); setMappingEdits({}); setStatusEdits({}); }}>
                {raw.sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
              </select>
            </label>
          )}
          {adapter && suggestion && (
            <div className="card" role="note">
              <h3>This looks like a {adapter.name}</h3>
              <ul>{suggestion.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
          {raw?.kind === 'xlsx' && (
            <p className="note">Excel stores a cell shown as 40% as 0.4. If your % complete column looks like that, choose "0 to 1" below.</p>
          )}
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
          {suggestion && suggestion.defaultUnit === null && (
            <p className="warn" role="alert">
              This tool's documentation does not say what unit its effort numbers use. We have not guessed. Check a few
              values in your file and choose the unit below.
            </p>
          )}
          <div className="form">
            <label>
              Effort numbers without a unit are in
              <select value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value as Unit)}>
                {defaultUnit === '' && <option value="" disabled>Choose a unit…</option>}
                <option value="points">points (not time)</option>
                <option value="seconds">seconds</option>
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
              Dates in my file are written as
              <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                <option value="auto">Unclear ones are refused (recommended)</option>
                <option value="dmy">Day / Month / Year</option>
                <option value="mdy">Month / Day / Year</option>
              </select>
            </label>
            <label>
              Spread planned work over
              <select value={dayCount} onChange={(e) => setDayCount(e.target.value as DayCount)}>
                <option value="weekdays">Weekdays, Monday to Friday</option>
                <option value="calendar">Every calendar day</option>
              </select>
            </label>
            <label>
              Status date (the day these numbers are as of)
              <span className="row">
                <input type="date" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} />
                <button type="button" onClick={() => setStatusDate(new Date().toLocaleDateString('en-CA'))}>Use today</button>
              </span>
            </label>
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

          {defaultUnit === '' && <p className="warn">Results appear once you choose the unit above.</p>}
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
                </div>
              )}
              <h3>Schedule (as of the status date)</h3>
              {!statusDate ? (
                <p className="warn">Choose a status date in step 2 to see schedule performance. It is not assumed.</p>
              ) : schedule && schedule.status !== 'not_available' ? (
                <>
                  <div className="grid">
                    <div className="card"><h4>Planned value (PV)</h4><p className="big">{fmt(schedule.pv)}</p><p className="note">Hours that should be done by {statusDate}.</p></div>
                    <div className="card"><h4>Earned value (EV)</h4><p className="big">{fmt(schedule.ev)}</p><p className="note">Same tasks, planned hours x % complete.</p></div>
                    <div className="card">
                      <h4>Schedule performance (SPI)</h4>
                      <p className="big">{schedule.spi === null ? 'Not available' : fmt(schedule.spi)}</p>
                      <p className="note">{schedule.spi === null ? 'Planned value is 0: nothing was due by this date.' : 'EV / PV. Below 1 means behind the plan.'}</p>
                    </div>
                    <div className="card"><h4>Schedule variance (SV)</h4><p className="big">{fmt(schedule.sv)}</p><p className="note">EV - PV. Negative means behind schedule.</p></div>
                  </div>
                  <p><strong>{schedule.counts.used} of {schedule.counts.total}</strong> tasks used for schedule measures.</p>
                  {schedule.caveats.map((c) => <p key={c} className="warn">{c}</p>)}
                  {schedule.excluded.length > 0 && (
                    <details>
                      <summary>Which tasks were left out of schedule measures, and why</summary>
                      <ul>{schedule.excluded.map((e) => <li key={e.id}>{e.id}: {e.reason}</li>)}</ul>
                    </details>
                  )}
                </>
              ) : (
                <p className="warn">Not available. Missing: {schedule?.missing.join(', ')}. Choose the start and finish date columns in step 1.</p>
              )}
              {quality && (
                <section className="card" aria-labelledby="dq-h">
                  <h3 id="dq-h">Data quality</h3>
                  {quality.score === null ? (
                    <p className="big">{quality.status === 'no_tasks' ? 'No tasks' : 'Insufficient data'}</p>
                  ) : (
                    <p className="big">
                      {quality.score} / 100{' '}
                      <meter min={0} max={100} value={quality.score} aria-label="Data quality score">{quality.score}</meter>
                    </p>
                  )}
                  <p>{quality.reading}</p>
                  <table>
                    <caption>How complete is each input?</caption>
                    <thead><tr><th scope="col">Input</th><th scope="col">Tasks with it</th><th scope="col">Share</th></tr></thead>
                    <tbody>
                      {quality.fields.map((f) => (
                        <tr key={f.field}>
                          <th scope="row">{f.label}</th>
                          <td>{f.present} of {f.total}</td>
                          <td>{f.percent === null ? 'n/a' : `${f.percent}%`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {quality.issueCounts.length > 0 && (
                    <p className="note">
                      Problems found while reading values:{' '}
                      {quality.issueCounts.map((i) => `${i.count} x ${issueLabel(i.code)}`).join('; ')}.
                    </p>
                  )}
                  <p className="note">{quality.how}</p>
                </section>
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
