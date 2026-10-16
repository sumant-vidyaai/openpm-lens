import { useEffect, useMemo, useState } from 'react';
import {
  IMPORT_FIELDS, parseMspdi, aggregateHoursEvm, buildWorkItems, costPerformanceIndex, costVariance,
  distinctStatuses, parseCsv, roundHalfUp, mergeMapping, suggestStatusCategory, toHoursTasks,
  aggregateSchedule, plannedValueCurve, assessQuality, earnedSchedule, forecast, EAC_METHODS, type EacMethod, summaryRows, taskRows, toCsv, evmSteps, explainEvmRows, explainScheduleRows, scheduleSteps, detectTableAdapter, toScheduleTasks, type DateOrder, type DayCount, issueLabel, tableFromGrid, type ColumnMapping, type CsvResult, type ImportField, type MissingPlannedPolicy, type PercentRule,
  type StatusCategory, type StatusMap, type Unit,
} from '@openpm-lens/core';
import readXlsxFile from 'read-excel-file/browser';
import { MAX_XML_BYTES } from './readFile';
import { EarnedValueChart } from './charts';
import { SAMPLE_CSV } from './sample';
import { ExplainPanel, StepsPanel } from './Explain';
import type { SharedData } from './shared';
import { ReplaceButton } from './common';

type Grid = (string | number | boolean | Date | null)[][];
type Raw =
  | { kind: 'csv'; text: string }
  | { kind: 'xlsx'; sheets: { name: string; data: Grid }[] }
  | { kind: 'table'; table: CsvResult; notes: string[] };

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

export function ImportScreen({ onShare }: { onShare: (d: SharedData | null) => void }) {
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
  const [eacMethod, setEacMethod] = useState<EacMethod>('typical');

  const csv = useMemo(() => {
    if (raw === null) return null;
    if (raw.kind === 'csv') return parseCsv(raw.text);
    if (raw.kind === 'table') return raw.table;
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
    () => (csv ? { ...mergeMapping(csv.headers, suggestion?.mapping ?? null), ...mappingEdits } : null),
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
    const schedTasks = toScheduleTasks(items, calendar, rule, config);
    const schedule = statusDate ? aggregateSchedule(schedTasks, statusDate, dayCount) : null;
    const earned = statusDate ? earnedSchedule(schedTasks, statusDate, dayCount) : null;
    const f = (n: number | null) => (n === null ? '-' : String(roundHalfUp(n, 2)));
    const evmRaw = explainEvmRows(tasks, missingPlanned);
    const schedRaw = statusDate ? explainScheduleRows(schedTasks, statusDate, dayCount) : [];
    const evmRows = evmRaw.map((r) => ({
      key: r.id, used: r.used,
      cells: [r.id, f(r.plannedHours), f(r.percentComplete), f(r.actualHours), f(r.ev), f(r.ac), r.note],
    }));
    const schedRows = statusDate
      ? schedRaw.map((r) => ({
          key: r.id, used: r.used,
          cells: [r.id, f(r.plannedHours), `${r.plannedStart ?? '-'} to ${r.plannedFinish ?? '-'}`,
            r.plannedShare === null ? '-' : `${roundHalfUp(r.plannedShare * 100, 0)}%`, f(r.pv), f(r.percentComplete), f(r.ev), r.note],
        }))
      : [];
    return {
      items, tasks, schedTasks, agg, schedule, earned, quality: assessQuality(items, tasks, agg), evmRows, schedRows, evmRaw, schedRaw,
      evmGroups: evmSteps(agg),
      schedGroups: schedule ? scheduleSteps(schedule, statusDate, dayCount) : [],
    };
  }, [csv, mapping, defaultUnit, percentScale, statusMap, hoursPerDay, rule, inProgressPercent, missingPlanned, dateOrder, dayCount, statusDate]);

  useEffect(() => {
    onShare(
      calc && csv
        ? { fileName: fileName ?? '', table: csv, items: calc.items, hoursTasks: calc.tasks, schedTasks: calc.schedTasks, statusDate, dateOrder, dayCount, hoursPerDay, summary: { ev: calc.agg.ev, ac: calc.agg.ac, bac: calc.agg.bac, pv: calc.schedule?.pv ?? null, evSchedule: calc.schedule?.ev ?? null, costTasks: calc.agg.counts.used, scheduleTasks: calc.schedule?.counts.used ?? 0, tasksTotal: calc.agg.counts.total } }
        : null,
    );
  }, [calc, csv, fileName, statusDate, dateOrder, dayCount, hoursPerDay, onShare]);
  const result = calc?.agg ?? null;
  const quality = calc?.quality ?? null;
  const schedule = calc?.schedule ?? null;
  const earned = calc?.earned ?? null;
  const fc = useMemo(
    () => (result ? forecast({ ev: result.ev, ac: result.ac, bac: result.bac, pv: schedule?.pv ?? null, evSchedule: schedule?.ev ?? null }, eacMethod) : null),
    [result, schedule, eacMethod],
  );
  const assumptions = [
    `Progress rule: ${RULES.find((r) => r.value === rule)?.label}${rule === 'status_based' ? ` (${inProgressPercent}% while in progress)` : ''}.`,
    `Effort numbers without a unit are read as ${defaultUnit}; one working day = ${hoursPerDay} hours.`,
    `Tasks with no planned effort: ${missingPlanned === 'exclude' ? 'left out and listed' : 'planned counted as 0 (worst case)'}.`,
    `File: ${fileName ?? ''}${raw?.kind === 'xlsx' ? `, sheet "${raw.sheets[sheetIdx]?.name ?? ''}"` : ''}.`,
  ];
  const assumptionsFull = [
    ...assumptions,
    ...(statusDate
      ? [
          `Status date: ${statusDate}. Planned hours spread evenly over ${dayCount === 'weekdays' ? 'weekdays (holidays not known)' : 'every calendar day'}.`,
          `Date order: ${dateOrder === 'auto' ? 'unclear dates are refused' : dateOrder === 'dmy' ? 'day / month / year' : 'month / day / year'}.`,
        ]
      : []),
  ];

  function saveFile(name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function reportInput() {
    return {
      fileName: fileName ?? '', toolName: adapter?.name ?? null, generatedOn: new Date().toLocaleDateString('en-CA'),
      statusDate: statusDate || null, assumptions: assumptionsFull, evm: result, schedule, quality, forecast: fc, earnedSchedule: earned,
    };
  }
  const stamp = () => statusDate || new Date().toLocaleDateString('en-CA');
  function printSummary() {
    const all = Array.from(document.querySelectorAll('details'));
    const was = all.map((d) => d.open);
    all.forEach((d) => { d.open = true; });
    const restore = () => { all.forEach((d, i) => { d.open = was[i] ?? false; }); window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  function reset(name: string, next: Raw) {
    setFileName(name); setRaw(next); setSheetIdx(0); setLoadError(null); setDefaultUnit('hours'); setRule('tool_reported'); setMappingEdits({}); setStatusEdits({});
  }
  async function onFile(f: File) {
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const sheets = await readXlsxFile(f);
        if (sheets.length === 0) throw new Error('The workbook has no sheets.');
        reset(f.name, { kind: 'xlsx', sheets: sheets.map((s) => ({ name: s.sheet, data: s.data as Grid })) });
      } else if (/\.xml$/i.test(f.name)) {
        if (f.size > MAX_XML_BYTES) throw new Error('The XML file is larger than 25 MB, which is more than a project plan should be. It was not read.');
        const r = parseMspdi(await f.text());
        reset(f.name, { kind: 'table', table: r.table, notes: r.notes });
        setMappingEdits(r.mapping);
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
      <h2 id="import-h" className="noprint">Import your tasks</h2>
      <p className="printonly">
        openpm-lens results for {fileName}. Made on {new Date().toLocaleDateString('en-CA')}
        {statusDate ? `; status date ${statusDate}` : ''}. Calculated in the browser from the file; nothing was uploaded.
      </p>
      <p className="lead noprint">
        Choose a CSV, Excel (.xlsx) or Microsoft Project XML (.xml) export from your tool. The file is read in this browser tab only. It is never uploaded.
      </p>
      <div className="row noprint">
        <label className="btn">
          Choose file{' '}
          <input
            type="file" accept=".csv,text/csv,.txt,.xlsx,.xml"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onFile(f);
              e.target.value = '';
            }}
          />
        </label>
        <ReplaceButton loaded={raw !== null && fileName !== 'sample.csv (made-up example)'} what={fileName ?? 'your file'} label="Try the made-up example" onConfirm={() => reset('sample.csv (made-up example)', { kind: 'csv', text: SAMPLE_CSV })} />
        {raw !== null && <ReplaceButton loaded={fileName !== 'sample.csv (made-up example)'} what={fileName ?? 'your file'} label="Clear" verb="removes" confirmLabel="Clear" onConfirm={() => { setFileName(null); setRaw(null); setSheetIdx(0); setLoadError(null); setMappingEdits({}); setStatusEdits({}); }} />}
      </div>

      {loadError && <p className="warn" role="alert">{loadError}</p>}
      {csv && mapping && (
        <>
          {raw?.kind === 'xlsx' && raw.sheets.length > 1 && (
            <label className="form noprint">
              Which sheet?
              <select value={sheetIdx} onChange={(e) => { setSheetIdx(Number(e.target.value)); setMappingEdits({}); setStatusEdits({}); }}>
                {raw.sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
              </select>
            </label>
          )}
          {adapter && suggestion && (
            <div className="card noprint" role="note">
              <h3>This looks like a {adapter.name}</h3>
              <ul>{suggestion.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
          {raw?.kind === 'table' && (
            <div className="card noprint" role="note">
              <h3>Read from a Microsoft Project XML file</h3>
              <ul>{raw.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
          {raw?.kind === 'xlsx' && (
            <p className="note noprint">Excel stores a cell shown as 40% as 0.4. If your % complete column looks like that, choose "0 to 1" below.</p>
          )}
          <p>
            <strong>{fileName}</strong>: {csv.rows.length} rows, {csv.headers.length} columns.
          </p>
          {csv.warnings.map((w) => <p key={w} className="warn">{w}</p>)}

          <h3 className="noprint">1. Which column is which?</h3>
          <p className="note noprint">We guessed from the column names. Please check each one.</p>
          <div className="form noprint">
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

          <h3 className="noprint">2. Units and assumptions</h3>
          {suggestion && suggestion.defaultUnit === null && (
            <p className="warn" role="alert">
              This tool's documentation does not say what unit its effort numbers use. We have not guessed. Check a few
              values in your file and choose the unit below.
            </p>
          )}
          <div className="form noprint">
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
              <h3 className="noprint">3. What does each status mean?</h3>
              <div className="form noprint">
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
              {calc && calc.evmGroups.length > 0 && (
                <ExplainPanel
                  title="Show the working for the cost numbers"
                  assumptions={assumptions}
                  groups={calc.evmGroups}
                  columns={['Task', 'Planned h', '% complete', 'Actual h', 'Adds to EV', 'Adds to AC', 'Status']}
                  rows={calc.evmRows}
                />
              )}
              {fc && fc.eac !== null || (fc && fc.reasons.length > 0) ? (
                <>
                  <h3>Forecast (where the cost is heading)</h3>
                  <label className="form">
                    How do you expect the rest of the work to go?
                    <select value={eacMethod} onChange={(e) => setEacMethod(e.target.value as EacMethod)}>
                      {EAC_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </label>
                  <p className="note">{EAC_METHODS.find((m) => m.value === eacMethod)?.when} The budget (BAC) here is the planned hours of the tasks used, not necessarily the whole project.</p>
                  <div className="grid">
                    <div className="card"><h4>Estimate at completion (EAC)</h4><p className="big">{fmt(fc.eac)}</p><p className="note">Forecast total hours when the work is finished.</p></div>
                    <div className="card"><h4>Estimate to complete (ETC)</h4><p className="big">{fmt(fc.etc)}</p><p className="note">EAC - AC: hours still to spend.</p></div>
                    <div className="card"><h4>Variance at completion (VAC)</h4><p className="big">{fmt(fc.vac)}</p><p className="note">BAC - EAC. Negative means a forecast overrun.</p></div>
                    <div className="card"><h4>To-complete index (TCPI)</h4><p className="big">{fmt(fc.tcpiBac)}</p><p className="note">(BAC - EV) / (BAC - AC): the CPI the rest of the work needs to finish within budget.</p></div>
                  </div>
                  {fc.reasons.map((r) => <p key={r} className="warn">{r}</p>)}
                  {fc.steps.length > 0 && (
                    <StepsPanel
                      title="Show the working for the forecast"
                      assumptions={[...assumptions, `Forecast method: ${EAC_METHODS.find((m) => m.value === eacMethod)?.label}.`]}
                      groups={fc.steps}
                    />
                  )}
                </>
              ) : null}
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
                  {calc && (() => { const c = plannedValueCurve(calc.schedTasks, dayCount); return <EarnedValueChart dates={c.dates} pv={c.pv} statusDate={statusDate} ev={schedule.ev} />; })()}
                  <p><strong>{schedule.counts.used} of {schedule.counts.total}</strong> tasks used for schedule measures.</p>
                  {schedule.caveats.map((c) => <p key={c} className="warn">{c}</p>)}
                  {calc && calc.schedGroups.length > 0 && (
                    <ExplainPanel
                      title="Show the working for the schedule numbers"
                      assumptions={[
                        ...assumptions,
                        `Status date: ${statusDate}. Planned hours are spread evenly over ${dayCount === 'weekdays' ? 'weekdays (holidays not known)' : 'every calendar day'}.`,
                        `Date order: ${dateOrder === 'auto' ? 'unclear dates are refused' : dateOrder === 'dmy' ? 'day / month / year' : 'month / day / year'}.`,
                      ]}
                      groups={calc.schedGroups}
                      columns={['Task', 'Planned h', 'Planned dates', 'Planned by now', 'Adds to PV', '% complete', 'Adds to EV', 'Status']}
                      rows={calc.schedRows}
                    />
                  )}
                  {earned && earned.status === 'computed' && (
                    <>
                      <h3>Earned schedule (schedule in time, not hours)</h3>
                      <div className="grid">
                        <div className="card"><h4>Earned schedule (ES)</h4><p className="big">{fmt(earned.es)}</p><p className="note">Days of the plan the work done so far is worth. Planned duration: {earned.plannedDuration} days.</p></div>
                        <div className="card"><h4>Actual time (AT)</h4><p className="big">{earned.at}</p><p className="note">Days from the first planned start ({earned.projectStart}) to the status date.</p></div>
                        <div className="card"><h4>Schedule performance in time, SPI(t)</h4><p className="big">{fmt(earned.spiT)}</p><p className="note">ES / AT. Below 1 means behind. Unlike SPI it does not drift back to 1 when a late project finishes.</p></div>
                        <div className="card"><h4>Schedule variance in time, SV(t)</h4><p className="big">{fmt(earned.svT)}</p><p className="note">ES - AT, in days. Negative means behind.</p></div>
                      </div>
                      {earned.caveats.map((c) => <p key={c} className="warn">{c}</p>)}
                      <StepsPanel
                        title="Show the working for earned schedule"
                        assumptions={[...assumptions, `Status date: ${statusDate}.`, `Days are ${dayCount === 'weekdays' ? 'weekdays (holidays not known)' : 'calendar days'}.`]}
                        groups={earned.steps}
                      />
                    </>
                  )}
                  {earned && earned.status === 'not_available' && <p className="warn">Earned schedule not available: {earned.reasons.join(' ')}</p>}
                </>
              ) : (
                <p className="warn">Not available. Missing: {schedule?.missing.join(', ')}. Choose the start and finish date columns in step 1.</p>
              )}
              <section className="card noprint" aria-labelledby="dl-h">
                <h3 id="dl-h">Share these results</h3>
                <p className="note">Files are made in this browser tab and saved to your device. Nothing is uploaded.</p>
                <div className="row">
                  <button type="button" onClick={() => saveFile(`openpm-lens-summary-${stamp()}.csv`, toCsv(summaryRows(reportInput())), 'text/csv;charset=utf-8')}>
                    Download summary (CSV)
                  </button>
                  <button type="button" onClick={() => saveFile(`openpm-lens-tasks-${stamp()}.csv`, toCsv(taskRows(calc?.evmRaw ?? [], calc?.schedRaw ?? [])), 'text/csv;charset=utf-8')}>
                    Download task detail (CSV)
                  </button>
                  <button type="button" onClick={printSummary}>Print or save as PDF</button>
                </div>
              </section>
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
