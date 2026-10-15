import { useMemo, useRef, useState } from 'react';
import {
  ALL_PROJECTS, analyseTable, DEFAULT_ANALYSE, DEFAULT_THRESHOLDS, HEALTH_LABEL, parseCsv, rollup, roundHalfUp,
  toCsv, validateThresholds, type AnalyseSettings, type CsvCell, type CsvResult, type DateOrder, type DayCount,
  type Health, type PortfolioProject, type RollupBy, type Unit,
} from '@openpm-lens/core';
import { readTable } from './readFile';
import { SAMPLE_PORTFOLIO } from './sample';

interface Entry {
  id: string;
  name: string;
  programme: string;
  team: string;
  fileName: string;
  table: CsvResult;
  unit: Unit | '';
  note: string | null;
}

const SYMBOL: Record<Health, string> = { green: '●', amber: '▲', red: '■', insufficient: '○' };
const BY_LABEL: Record<RollupBy, string> = {
  project: 'Each project', programme: 'Each programme', team: 'Each team', all: 'Whole portfolio',
};

function Rag({ health }: { health: Health }) {
  return <span className={`rag rag-${health}`}><span aria-hidden="true">{SYMBOL[health]}</span> {HEALTH_LABEL[health]}</span>;
}

export function PortfolioScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusDate, setStatusDate] = useState('');
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto');
  const [dayCount, setDayCount] = useState<DayCount>('weekdays');
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [percentScale, setPercentScale] = useState<'0-100' | '0-1'>('0-100');
  const [by, setBy] = useState<RollupBy>('programme');
  const [green, setGreen] = useState(String(DEFAULT_THRESHOLDS.greenMin));
  const [amber, setAmber] = useState(String(DEFAULT_THRESHOLDS.amberMin));
  const [minTasks, setMinTasks] = useState(String(DEFAULT_THRESHOLDS.minTasks));
  const nextId = useRef(1);

  const parsed = { greenMin: Number(green), amberMin: Number(amber), minTasks: Number(minTasks) };
  const invalid = validateThresholds(parsed);
  const incomplete = [green, amber, minTasks].some((x) => x.trim() === '');
  const thresholdProblem = incomplete ? 'Enter all three limits.' : invalid;
  const thresholds = thresholdProblem === null ? parsed : DEFAULT_THRESHOLDS;
  const usingDefaults = parsed.greenMin === DEFAULT_THRESHOLDS.greenMin && parsed.amberMin === DEFAULT_THRESHOLDS.amberMin && parsed.minTasks === DEFAULT_THRESHOLDS.minTasks;

  function add(next: Omit<Entry, 'id'>[]) {
    setEntries((cur) => [...cur, ...next.map((e) => ({ ...e, id: `p${nextId.current++}` }))]);
  }
  async function onFiles(files: FileList) {
    setError(null);
    const added: Omit<Entry, 'id'>[] = [];
    const problems: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const { table, note } = await readTable(f);
        added.push({ name: f.name.replace(/\.[^.]+$/, ''), programme: '', team: '', fileName: f.name, table, unit: '', note });
      } catch (err) {
        problems.push(err instanceof Error ? err.message : `${f.name} could not be read.`);
      }
    }
    add(added);
    if (problems.length > 0) setError(problems.join(' '));
  }
  function addSamples() {
    setError(null);
    add(SAMPLE_PORTFOLIO.map((s) => ({
      name: s.name, programme: s.programme, team: s.team, fileName: `${s.name}.csv (made-up example)`, table: parseCsv(s.csv), unit: '' as const, note: null,
    })));
    setStatusDate('2026-01-21');
  }
  const edit = (id: string, patch: Partial<Entry>) => setEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const settings: AnalyseSettings = useMemo(
    () => ({ ...DEFAULT_ANALYSE, statusDate, dateOrder, dayCount, hoursPerDay, percentScale }),
    [statusDate, dateOrder, dayCount, hoursPerDay, percentScale],
  );
  const projects: PortfolioProject[] = useMemo(
    () => entries.map((e) => ({
      id: e.id, name: e.name || e.fileName, programme: e.programme, team: e.team,
      result: analyseTable(e.table, { ...settings, unitOverride: e.unit === '' ? null : e.unit }),
    })),
    [entries, settings],
  );
  const rows = useMemo(() => rollup(projects, by, thresholds), [projects, by, thresholds]);

  const f = (n: number | null, d = 2) => (n === null ? '-' : String(roundHalfUp(n, d)));
  const assumptions = [
    `Hours are summed first; CPI and SPI are worked out from the sums (ratios are never averaged).`,
    `Status date: ${statusDate || 'not chosen (schedule measures not worked out)'}. Planned hours spread evenly over ${dayCount === 'weekdays' ? 'weekdays' : 'calendar days'}.`,
    `Date order: ${dateOrder === 'auto' ? 'unclear dates are refused' : dateOrder === 'dmy' ? 'day / month / year' : 'month / day / year'}. One working day = ${hoursPerDay} hours.`,
    `A roll-up includes every project that has numbers, even one whose own status is "Insufficient data".`,
    `Health: green at ${thresholds.greenMin} or above, amber at ${thresholds.amberMin} or above, red below; an index needs at least ${thresholds.minTasks} tasks behind it. These are starting values, not a standard${usingDefaults ? '' : ' (edited by you)'}.`,
  ];

  const r4 = (n: number | null) => (n === null ? null : roundHalfUp(n, 4));
  function download() {
    const csvRows: CsvCell[][] = [
      ['Group', 'Projects', 'Health', 'CPI', 'SPI', 'EV (hours)', 'AC (hours)', 'CV (hours)', 'PV (hours)', 'SV (hours)', 'Cost tasks used', 'Schedule tasks used', 'Projects left out of cost', 'Projects left out of schedule', 'Projects not ready', 'Why'],
      ...rows.map((r): CsvCell[] => [
        r.label, r.projects, HEALTH_LABEL[r.health.health], r.health.cpi === null ? null : roundHalfUp(r.health.cpi, 4),
        r.health.spi === null ? null : roundHalfUp(r.health.spi, 4), r4(r.ev), r4(r.ac), r4(r.cv), r4(r.pv), r4(r.sv), r.costTasks, r.scheduleTasks,
        r.leftOutCost, r.leftOutSchedule, r.notReady, r.health.reasons.join(' '),
      ]),
      [],
      ...assumptions.map((a): CsvCell[] => ['Assumption', a]),
      ['Note', 'Numbers rounded to 4 decimal places; calculations used unrounded values.'],
      ['Report made on', new Date().toLocaleDateString('en-CA')],
    ];
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(csvRows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `openpm-lens-portfolio-${by}-${statusDate || new Date().toLocaleDateString('en-CA')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-labelledby="pf-h">
      <h2 id="pf-h">Portfolio view</h2>
      <p className="lead">
        Load one file per project. Each project gets a health status, and you can roll the projects up by programme or team.
        Files are read in this browser tab only and never uploaded.
      </p>
      <div className="row noprint">
        <label className="btn">
          Add files{' '}
          <input type="file" multiple accept=".csv,text/csv,.txt,.xlsx" onChange={async (e) => {
            const files = e.target.files;
            if (files && files.length > 0) await onFiles(files);
            e.target.value = '';
          }} />
        </label>
        <button type="button" onClick={addSamples}>Try three made-up projects</button>
        {entries.length > 0 && <button type="button" onClick={() => setEntries([])}>Clear all</button>}
      </div>
      {error && <p className="warn" role="alert">{error}</p>}

      {entries.length === 0 ? (
        <p className="note">No projects yet. Add files, or try the made-up examples.</p>
      ) : (
        <>
          <h3>1. Your projects</h3>
          <p className="note">Type a programme and a team for each project to roll them up. Leave blank if not needed.</p>
          <div className="scroll">
            <table>
              <caption>Projects loaded</caption>
              <thead><tr><th>Project</th><th>Programme</th><th>Team</th><th>Effort unit</th><th>Tasks</th><th>Status</th><th><span className="sr">Remove</span></th></tr></thead>
              <tbody>
                {projects.map((p) => {
                  const e = entries.find((x) => x.id === p.id);
                  if (!e) return null;
                  return (
                    <tr key={p.id}>
                      <td><input aria-label={`Project name for ${e.fileName}`} value={e.name} onChange={(ev) => edit(p.id, { name: ev.target.value })} /></td>
                      <td><input aria-label={`Programme for ${e.name}`} value={e.programme} onChange={(ev) => edit(p.id, { programme: ev.target.value })} /></td>
                      <td><input aria-label={`Team for ${e.name}`} value={e.team} onChange={(ev) => edit(p.id, { team: ev.target.value })} /></td>
                      <td>
                        <select aria-label={`Effort unit for ${e.name}`} value={e.unit} onChange={(ev) => edit(p.id, { unit: ev.target.value as Unit | '' })}>
                          <option value="">{p.result.adapterName ? "Tool's unit" : 'Hours'}</option>
                          <option value="seconds">seconds</option><option value="minutes">minutes</option><option value="hours">hours</option>
                          <option value="days">days</option><option value="weeks">weeks</option>
                        </select>
                      </td>
                      <td>{p.result.tasks}</td>
                      <td>
                        {p.result.state === 'needs_unit' && <span className="warn">Choose the effort unit.</span>}
                        {p.result.state === 'needs_name_column' && <span className="warn">No task name column found. Use the Import tab to map columns.</span>}
                        {p.result.state === 'ok' && (p.result.adapterName ?? `Generic file: effort read as ${e.unit === '' ? 'hours' : e.unit}. Change the unit if that is wrong.`)}
                        {e.note && <span className="note"> {e.note}</span>}
                      </td>
                      <td><button type="button" aria-label={`Remove ${e.name}`} onClick={() => setEntries((cur) => cur.filter((x) => x.id !== p.id))}>Remove</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3>2. Settings for all projects</h3>
          <div className="form">
            <label>Status date (needed for SPI)<input type="date" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} /></label>
            <label>Dates in my files are written as
              <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                <option value="auto">Not sure (refuse unclear dates)</option>
                <option value="dmy">day / month / year</option>
                <option value="mdy">month / day / year</option>
              </select>
            </label>
            <label>Planned work is spread over
              <select value={dayCount} onChange={(e) => setDayCount(e.target.value as DayCount)}>
                <option value="weekdays">weekdays (Mon to Fri)</option>
                <option value="calendar">every calendar day</option>
              </select>
            </label>
            <label>Hours in one working day
              <input type="number" min={1} max={24} value={hoursPerDay} onChange={(e) => setHoursPerDay(Number(e.target.value) || 8)} />
            </label>
            <label>% complete is written as
              <select value={percentScale} onChange={(e) => setPercentScale(e.target.value as '0-100' | '0-1')}>
                <option value="0-100">0 to 100</option><option value="0-1">0 to 1</option>
              </select>
            </label>
          </div>

          <h3>3. Health limits (starting values, not a standard)</h3>
          <p className="note">
            Applies to both CPI (cost) and SPI (schedule). Green at or above the green limit, amber at or above the amber limit, red below.
            An index is only used when enough tasks stand behind it; otherwise the status says "Insufficient data".
          </p>
          <div className="form">
            <label>Green at or above<input type="number" step="0.01" value={green} onChange={(e) => setGreen(e.target.value)} /></label>
            <label>Amber at or above<input type="number" step="0.01" value={amber} onChange={(e) => setAmber(e.target.value)} /></label>
            <label>Minimum tasks behind an index<input type="number" step="1" min={1} value={minTasks} onChange={(e) => setMinTasks(e.target.value)} /></label>
            <div className="row">
              <button type="button" onClick={() => { setGreen(String(DEFAULT_THRESHOLDS.greenMin)); setAmber(String(DEFAULT_THRESHOLDS.amberMin)); setMinTasks(String(DEFAULT_THRESHOLDS.minTasks)); }}>
                Reset to starting values
              </button>
            </div>
          </div>
          {thresholdProblem !== null && (
            <p className="warn" role="alert">{thresholdProblem} Not applied; showing the starting values.</p>
          )}

          <h3>4. Health and roll-up</h3>
          <div className="row">
            <label>Show
              <select value={by} onChange={(e) => setBy(e.target.value as RollupBy)}>
                {(Object.keys(BY_LABEL) as RollupBy[]).map((k) => <option key={k} value={k}>{BY_LABEL[k]}</option>)}
              </select>
            </label>
            <button type="button" className="noprint" onClick={download}>Download roll-up (CSV)</button>
          </div>
          <div className="scroll">
            <table>
              <caption>{BY_LABEL[by]} (hours)</caption>
              <thead>
                <tr><th>{by === 'all' ? 'Group' : by === 'project' ? 'Project' : by === 'programme' ? 'Programme' : 'Team'}</th>
                  <th>Projects</th><th>Health</th><th>CPI</th><th>SPI</th><th>EV</th><th>AC</th><th>CV</th><th>PV</th><th>SV</th><th>Tasks used (cost / schedule)</th><th>Left out</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row">{r.label === ALL_PROJECTS ? r.label : r.label}</th>
                    <td>{r.projects}</td><td><Rag health={r.health.health} /></td>
                    <td>{f(r.health.cpi)}</td><td>{f(r.health.spi)}</td>
                    <td>{f(r.ev)}</td><td>{f(r.ac)}</td><td>{f(r.cv)}</td><td>{f(r.pv)}</td><td>{f(r.sv)}</td>
                    <td>{r.costTasks} / {r.scheduleTasks}</td>
                    <td>{r.leftOutCost + r.leftOutSchedule + r.notReady === 0 ? 'None' : `${r.leftOutCost} cost, ${r.leftOutSchedule} schedule, ${r.notReady} not ready`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="explain" open>
            <summary>Why each status</summary>
            <ul>
              {rows.map((r) => (
                <li key={r.key}><strong>{r.label}:</strong> {r.health.reasons.length === 0 ? 'No index could be worked out.' : r.health.reasons.join(' ')}</li>
              ))}
            </ul>
          </details>
          <details className="explain" open>
            <summary>Assumptions in force</summary>
            <ul>{assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          </details>
        </>
      )}
    </section>
  );
}
