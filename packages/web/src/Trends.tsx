import { useEffect, useMemo, useState } from 'react';
import {
  addSnapshot, compareSnapshots, type CsvCell, cpiOf, daysSinceUpdate, roundHalfUp, seriesOf, snapshotId, snapshotLabels, SNAPSHOT_FORMAT, spiOf,
  toggleBaseline, trendPoints, validateSnapshot, type Snapshot,
} from '@openpm-lens/core';
import { computeRaid } from './Raid';
import { StackedChart, TrendChart } from './trendCharts';
import { NeedsImport, saveCsv } from './common';
import type { SharedData } from './shared';

const KEY = 'openpm-lens-snapshots-v1';
const MAX_FILE = 2_000_000;

function loadStored(): Snapshot[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((x) => { const r = validateSnapshot(x); return r.snapshot ? [r.snapshot] : []; });
  } catch { return []; }
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** One row per snapshot, for opening in Excel. A number that was not known is left blank, never 0. */
export function snapshotRows(list: Snapshot[]): CsvCell[][] {
  const head = ['Label', 'Status date', 'Saved at', 'Source file', 'Baseline', 'Budget (h)', 'Planned value (h)', 'Earned value (h)', 'Actual cost (h)', 'CPI', 'SPI',
    'Earned value for schedule (h)', 'Tasks', 'Not started', 'In progress', 'Done', 'Cancelled', 'Open defects', 'Open high risks', 'Open medium risks', 'Open low risks',
    'Open unscored risks', 'Open issues', 'Approved change hours', 'Approved change days'];
  const r4 = (n: number | null) => (n === null ? '' : roundHalfUp(n, 4));
  const v = (n: number | null) => (n === null ? '' : n);
  const sorted = [...list].sort((a, b) => a.label.localeCompare(b.label) || a.statusDate.localeCompare(b.statusDate));
  return [head, ...sorted.map((s) => [
    s.label, s.statusDate, s.savedAt, s.source, s.baseline ? 'Yes' : 'No', v(s.bac), r4(s.pv), v(s.ev), v(s.ac), r4(cpiOf(s)), r4(spiOf(s)), v(s.evSchedule),
    s.counts.total, s.counts.notStarted, s.counts.inProgress, s.counts.done, s.counts.cancelled, v(s.openDefects),
    v(s.raid?.risksHigh ?? null), v(s.raid?.risksMedium ?? null), v(s.raid?.risksLow ?? null), v(s.raid?.risksUnscored ?? null), v(s.raid?.openIssues ?? null), v(s.raid?.approvedHours ?? null), v(s.raid?.approvedDays ?? null),
  ])];
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const guessType = (headers: string[]) => headers.find((h) => /^(issue |work item |item )?type$/i.test(h.trim())) ?? null;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Turns what is loaded on Import into a snapshot (totals only, no task names). */
export function buildSnapshot(shared: SharedData, label: string): Snapshot {
  const n = (c: string) => shared.items.filter((i) => i.statusCategory === c).length;
  const jT = guessType(shared.table.headers) === null ? -1 : shared.table.headers.indexOf(guessType(shared.table.headers) as string);
  let openDefects: number | null = null;
  if (jT >= 0) {
    openDefects = shared.items.reduce((a, it, i) => (/bug|defect|incident|problem/i.test(shared.table.rows[i]?.[jT] ?? '') && it.statusCategory !== 'done' && it.statusCategory !== 'cancelled' ? a + 1 : a), 0);
  }
  const raid = computeRaid(shared);
  const sm = shared.summary;
  return {
    format: SNAPSHOT_FORMAT, version: 1, savedAt: new Date().toISOString(), label: label.trim(), statusDate: shared.statusDate, source: shared.fileName, baseline: false,
    ev: sm.ev, ac: sm.ac, bac: sm.bac, pv: sm.pv, evSchedule: sm.evSchedule, costTasks: sm.costTasks, scheduleTasks: sm.scheduleTasks,
    counts: { total: shared.items.length, notStarted: n('not_started'), inProgress: n('in_progress'), done: n('done'), cancelled: n('cancelled') },
    openDefects,
    raid: raid && (raid.risks || raid.issues || raid.changes) ? {
      risksHigh: raid.risks?.openCounts.high ?? null, risksMedium: raid.risks?.openCounts.medium ?? null, risksLow: raid.risks?.openCounts.low ?? null,
      risksUnscored: raid.risks?.openUnscored ?? null, openIssues: raid.issues?.open ?? null,
      approvedHours: raid.changes?.approvedHours ?? null, approvedDays: raid.changes?.approvedDays ?? null,
    } : null,
  };
}

const fmt = (key: string, unit: string, v: number | null, signed = false): string => {
  if (v === null) return 'not available';
  const d = key === 'cpi' || key === 'spi' ? 2 : unit === 'h' ? 1 : 0;
  const r = roundHalfUp(v, d);
  return `${signed && r > 0 ? '+' : ''}${r}${unit === 'h' ? ' h' : ''}`;
};

export function TrendsScreen({ shared, onGoImport }: { shared: SharedData | null; onGoImport: () => void }) {
  const [list, setList] = useState<Snapshot[]>(loadStored);
  const [stored, setStored] = useState(true);
  const [msg, setMsg] = useState('');
  const [label, setLabel] = useState('');
  const [typed, setTyped] = useState(false);
  const [pickLabel, setPickLabel] = useState<string | null>(null);
  const [pickA, setPickA] = useState<string | null>(null);
  const [pickB, setPickB] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => { if (shared && !typed) setLabel(shared.fileName.replace(/\.[^.]+$/, '')); }, [shared, typed]);

  function commit(next: Snapshot[]) {
    setList(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); setStored(true); } catch { setStored(false); }
  }

  const labels = useMemo(() => snapshotLabels(list), [list]);
  const active = pickLabel !== null && labels.includes(pickLabel) ? pickLabel : (labels.includes(label.trim()) ? label.trim() : labels[0] ?? null);
  const series = useMemo(() => (active === null ? [] : seriesOf(list, active)), [list, active]);
  const points = useMemo(() => trendPoints(series), [series]);
  const dates = points.map((p) => p.date);

  const baseline = series.find((s) => s.baseline) ?? null;
  const latest = series[series.length - 1] ?? null;
  const idA = pickA !== null && series.some((s) => snapshotId(s) === pickA) ? pickA : (baseline ?? series[0] ?? null) && snapshotId((baseline ?? series[0]) as Snapshot);
  const idB = pickB !== null && series.some((s) => snapshotId(s) === pickB) ? pickB : latest ? snapshotId(latest) : null;
  const snapA = series.find((s) => snapshotId(s) === idA) ?? null;
  const snapB = series.find((s) => snapshotId(s) === idB) ?? null;
  const cmp = snapA && snapB ? compareSnapshots(snapA, snapB) : null;
  const since = daysSinceUpdate(series, today());

  function save() {
    if (!shared) return;
    if (!shared.statusDate) { setMsg('Choose a status date on the Import tab first: a snapshot is filed under its status date.'); return; }
    if (label.trim() === '') { setMsg('Give the snapshot a label, for example the project name.'); return; }
    const s = buildSnapshot(shared, label);
    const r = addSnapshot(list, s);
    commit(r.list);
    setPickLabel(s.label);
    setMsg(`${r.replaced ? 'Replaced' : 'Saved'} the snapshot "${s.label}" for status date ${s.statusDate}.`);
  }
  async function upload(files: FileList | null) {
    if (!files) return;
    let next = list; let added = 0; const problems: string[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE) { problems.push(`${f.name}: too large to be a snapshot file.`); continue; }
      let data: unknown;
      try { data = JSON.parse(await f.text()); } catch { problems.push(`${f.name}: not a readable snapshot file.`); continue; }
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        const r = validateSnapshot(it);
        if (r.snapshot) { next = addSnapshot(next, r.snapshot).list; added += 1; } else problems.push(`${f.name}: ${r.problem}`);
      }
    }
    if (added > 0) commit(next);
    setMsg(`${plural(added, 'snapshot')} added.${problems.length > 0 ? ` Not added: ${problems.slice(0, 3).join(' ')}${problems.length > 3 ? ` (and ${problems.length - 3} more)` : ''}` : ''}`);
  }
  const sorted = [...list].sort((a, b) => a.label.localeCompare(b.label) || a.statusDate.localeCompare(b.statusDate));

  /** Opens the browser's print window with the report; the person chooses "Save as PDF". The file name suggestion is set through the page title. */
  function printReport() {
    const oldTitle = document.title;
    document.title = `openpm-lens report - ${active ?? 'snapshots'} - ${latest?.statusDate ?? ''}`.trim();
    const restore = () => { document.title = oldTitle; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  }
  return (
    <section aria-labelledby="tr-h">
      <h2 id="tr-h">Snapshots and trends</h2>
      <p className="lead noprint">A snapshot is a dated copy of the headline numbers. Save one each time you update the project, then compare dates and watch the trend. A snapshot holds totals only (hours and counts), never task names.</p>

      {active !== null && latest && (
        <div className="printonly">
          <h3>Snapshot report: {active}</h3>
          <p>
            Prepared on {today()} on this device. {plural(series.length, 'snapshot')}, status dates {series[0]?.statusDate} to {latest.statusDate}.
            {baseline ? ` Baseline: ${baseline.statusDate}.` : ' No baseline chosen.'}
            {cpiOf(latest) !== null ? ` Latest CPI ${roundHalfUp(cpiOf(latest) as number, 2)}` : ''}{spiOf(latest) !== null ? `, SPI ${roundHalfUp(spiOf(latest) as number, 2)}` : ''}{cpiOf(latest) !== null || spiOf(latest) !== null ? '.' : ''}
          </p>
          <p>Hours and counts come from the file loaded when each snapshot was saved. The limits for good and bad are starting values, not a standard. Your data stayed on your device.</p>
        </div>
      )}

      <div className="panel noprint">
        <h3>Save a snapshot</h3>
        {!shared && <NeedsImport onGo={onGoImport} />}
        {shared && (
          <>
            <p>Loaded: <strong>{shared.fileName}</strong>{shared.statusDate ? `, status date ${shared.statusDate}` : ' (no status date chosen yet)'}.</p>
            <div className="snap-form">
              <label>Label <input type="text" value={label} maxLength={120} onChange={(e) => { setLabel(e.target.value); setTyped(true); }} /></label>
              <button type="button" className="primary" onClick={save}>Save snapshot of what is loaded</button>
            </div>
            <p className="note">Saving the same label and status date again replaces the earlier snapshot. Snapshots with the same label are compared with each other.</p>
          </>
        )}
        <div className="snap-actions">
          <label className="btn">Add snapshot files <input type="file" accept=".json,application/json" multiple onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} /></label>
          {list.length > 0 && <button type="button" onClick={() => download('openpm-lens-snapshots.json', JSON.stringify(list, null, 2))}>Download all snapshots</button>}
          {series.length >= 1 && <button type="button" onClick={printReport}>Download report (PDF, with charts)</button>}
          {list.length > 0 && <button type="button" onClick={() => saveCsv('openpm-lens-snapshots.csv', snapshotRows(list))}>Download as spreadsheet (CSV, opens in Excel)</button>}
        </div>
        <p role="status" aria-live="polite">{msg}</p>
        <p className="note">The PDF button opens your browser's print window: choose "Save as PDF" as the printer. Charts and the comparison table are included.</p>
        {!stored && <p className="warn">This browser would not keep the snapshots on this device (a private window or blocked storage). They are kept until you close the tab: download them to keep them.</p>}
        <p className="note">Snapshots are kept in this browser on this device only. Clearing site data removes them, so download a copy now and then.</p>
      </div>

      {list.length > 0 && (
        <div className="noprint">
          <h3>Saved snapshots</h3>
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Saved snapshots (this device)</caption>
              <thead><tr><th scope="col">Label</th><th scope="col">Status date</th><th scope="col" className="num">CPI</th><th scope="col" className="num">SPI</th><th scope="col">Baseline</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {sorted.map((s) => {
                  const id = snapshotId(s);
                  return (
                    <tr key={id}>
                      <th scope="row">{s.label}</th>
                      <td>{s.statusDate}</td>
                      <td className="num">{cpiOf(s) === null ? '-' : roundHalfUp(cpiOf(s) as number, 2)}</td>
                      <td className="num">{spiOf(s) === null ? '-' : roundHalfUp(spiOf(s) as number, 2)}</td>
                      <td><button type="button" aria-pressed={s.baseline} onClick={() => commit(toggleBaseline(list, id))}>{s.baseline ? '★ Baseline (remove)' : 'Make baseline'}</button></td>
                      <td>
                        <button type="button" onClick={() => download(`openpm-lens-snapshot-${s.label.replace(/[^A-Za-z0-9]+/g, '-')}-${s.statusDate}.json`, JSON.stringify(s, null, 2))}>Download</button>{' '}
                        {confirmDel === id ? (
                          <>Delete this one? <button type="button" onClick={() => { commit(list.filter((x) => snapshotId(x) !== id)); setConfirmDel(null); setMsg('Snapshot deleted.'); }}>Delete</button> <button type="button" onClick={() => setConfirmDel(null)}>Keep</button></>
                        ) : <button type="button" onClick={() => setConfirmDel(id)}>Delete</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>
            {confirmAll ? (
              <>Delete all {list.length} snapshots on this device? <button type="button" onClick={() => { commit([]); setConfirmAll(false); setMsg('All snapshots deleted.'); }}>Delete all</button> <button type="button" onClick={() => setConfirmAll(false)}>Keep them</button></>
            ) : <button type="button" onClick={() => setConfirmAll(true)}>Delete all snapshots</button>}
          </p>
          <p className="note">The baseline is the snapshot you treat as the plan to compare against (usually the first one after approval). Each label has at most one.</p>
        </div>
      )}

      {labels.length > 1 && (
        <p className="noprint"><label>Show trends for <select value={active ?? ''} onChange={(e) => { setPickLabel(e.target.value); setPickA(null); setPickB(null); }}>{labels.map((l) => <option key={l}>{l}</option>)}</select></label></p>
      )}

      {active !== null && latest && (
        <p className="note">
          Latest snapshot for "{active}": status date {latest.statusDate}{since === null ? '' : `, ${plural(since, 'day')} before today on this device`}. {plural(series.length, 'snapshot')} in this series.
        </p>
      )}

      {cmp && snapA && snapB && series.length >= 2 && (
        <section aria-labelledby="cmp-h">
          <h3 id="cmp-h">Compare two dates</h3>
          <div className="form noprint">
            <label>From <select value={idA ?? ''} onChange={(e) => setPickA(e.target.value)}>{series.map((s) => <option key={snapshotId(s)} value={snapshotId(s)}>{s.statusDate}{s.baseline ? ' (baseline)' : ''}</option>)}</select></label>
            <label>To <select value={idB ?? ''} onChange={(e) => setPickB(e.target.value)}>{series.map((s) => <option key={snapshotId(s)} value={snapshotId(s)}>{s.statusDate}{s.baseline ? ' (baseline)' : ''}</option>)}</select></label>
          </div>
          {cmp.days < 0 && <p className="note">"From" is later than "To", so changes are shown backwards.</p>}
          <p>
            {Math.abs(cmp.days)} days between {snapA.statusDate} and {snapB.statusDate}.
            {snapA.bac !== null && snapB.bac !== null && snapA.bac > 0 ? ` The budget (planned hours) changed by ${fmt('bac', 'h', snapB.bac - snapA.bac, true)} (${roundHalfUp(((snapB.bac - snapA.bac) / snapA.bac) * 100, 1)}%).` : ''}
          </p>
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Snapshot comparison: {snapA.statusDate} and {snapB.statusDate}</caption>
              <thead><tr><th scope="col">Measure</th><th scope="col" className="num">{snapA.statusDate}</th><th scope="col" className="num">{snapB.statusDate}</th><th scope="col" className="num">Change</th></tr></thead>
              <tbody>
                {cmp.rows.map((r) => (
                  <tr key={r.key}><th scope="row">{r.label}</th><td className="num">{fmt(r.key, r.unit, r.a)}</td><td className="num">{fmt(r.key, r.unit, r.b)}</td><td className="num">{fmt(r.key, r.unit, r.change, true)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">"Not available" means the number was not known when that snapshot was saved (for example no risk sheet). It is not treated as 0.</p>
        </section>
      )}

      {active !== null && series.length === 1 && <p className="note">One snapshot so far. Save another one at a later status date to see trends and comparisons.</p>}

      {active !== null && series.length >= 2 && (
        <section aria-labelledby="trend-h">
          <h3 id="trend-h">Trends for "{active}"</h3>
          <TrendChart title="CPI and SPI over time" yLabel="Index" dates={dates} refLine={{ value: 1, label: '1.0 = on plan' }}
            series={[{ name: 'CPI (cost)', cls: 's1', values: points.map((p) => p.cpi) }, { name: 'SPI (schedule)', cls: 's2', values: points.map((p) => p.spi) }]}
            note="Each point is the index at that snapshot's status date. A gap means the index could not be worked out then." />
          <TrendChart title="Burnup: scope and work done (hours)" yLabel="Hours" dates={dates} decimals={1}
            series={[{ name: 'Scope (planned hours)', cls: 's1', values: points.map((p) => p.scope) }, { name: 'Work done (earned value)', cls: 's2', values: points.map((p) => p.earned) }]}
            note="When the scope line moves, the plan changed. Work done comes from the progress rule you chose, so it is only as good as the % complete." />
          <TrendChart title="Burndown: work remaining (hours)" yLabel="Hours" dates={dates} decimals={1}
            series={[{ name: 'Remaining (scope minus work done)', cls: 's1', values: points.map((p) => p.remaining) }]}
            note="Remaining = planned hours minus earned value at each snapshot. It can go up when scope is added." />
          <StackedChart title="Cumulative flow: tasks by status" yLabel="Tasks" dates={dates}
            layers={[{ name: 'Done', cls: 's1', values: points.map((p) => p.done) }, { name: 'In progress', cls: 's2', values: points.map((p) => p.inProgress) }, { name: 'Not started', cls: 's3', values: points.map((p) => p.notStarted) }]}
            note="Cancelled tasks are left out. A widening middle band means work is piling up in progress." />
          <TrendChart title="Throughput between snapshots (tasks finished per week)" yLabel="Tasks per week" dates={dates} decimals={2}
            series={[{ name: 'Tasks finished per week', cls: 's1', values: points.map((p) => p.throughputPerWeek) }]}
            note="Tasks that became done since the previous snapshot, divided by the weeks between them. The first snapshot has no earlier one to compare with." />
          {points.some((p) => p.openDefects !== null) && (
            <TrendChart title="Open defects" yLabel="Defects" dates={dates} decimals={0} series={[{ name: 'Open defects', cls: 's1', values: points.map((p) => p.openDefects) }]}
              note="Rows whose type contains bug, defect, incident or problem and that are not done." />
          )}
          {points.some((p) => p.openRisks !== null || p.openIssues !== null) && (
            <TrendChart title="Open risks and issues" yLabel="Count" dates={dates} decimals={0}
              series={[{ name: 'Open risks', cls: 's1', values: points.map((p) => p.openRisks) }, { name: 'High risks', cls: 's2', values: points.map((p) => p.risksHigh) }, { name: 'Open issues', cls: 's3', values: points.map((p) => p.openIssues) }]} />
          )}
        </section>
      )}
    </section>
  );
}
