import { useEffect, useMemo, useState } from 'react';
import {
  analyseNetwork, analyseThreePoint, countDays, countedDayDate, parseDependsOn, reserveCheck, reserveStack, roundHalfUp,
  type NetworkTask, type ReserveState,
} from '@spashta/core';
import { ColumnSelect, NeedsImport } from './common';
import type { SharedData } from './shared';

const find = (headers: string[], re: RegExp) => headers.find((h) => re.test(h.trim())) ?? null;
const f1 = (x: number) => String(roundHalfUp(x, 1));
const readNum = (t: string | undefined): number | null => {
  const s = (t ?? '').trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};

const RESERVE_TEXT: Record<ReserveState, string> = {
  no_overrun: 'No overrun is expected at the current cost performance, so no reserve is needed.',
  within_contingency: 'The expected overrun fits inside the contingency reserve. The project manager can cover it.',
  needs_management: 'The expected overrun is bigger than the contingency reserve. The rest would have to come from the management reserve, which the sponsor controls.',
  exceeds_budget: 'The expected overrun is bigger than contingency and management reserve together. It goes beyond the whole project budget.',
  unknown: 'Cannot be judged: enter a contingency reserve (0 is allowed) and make sure cost performance can be worked out.',
};

export function PlanningScreen({ shared, onGoImport }: { shared: SharedData | null; onGoImport: () => void }) {
  const headers = shared?.table.headers ?? [];
  const [oPick, setOPick] = useState<string | null | undefined>(undefined);
  const [pPick, setPPick] = useState<string | null | undefined>(undefined);
  const [dPick, setDPick] = useState<string | null | undefined>(undefined);
  const [tPick, setTPick] = useState<string | null | undefined>(undefined);
  const [prPick, setPrPick] = useState<string | null | undefined>(undefined);
  const [project, setProject] = useState('');
  const [view, setView] = useState<'plan' | 'remaining'>('plan');
  const [cont, setCont] = useState<string | undefined>(undefined);
  const [mgmt, setMgmt] = useState<string | undefined>(undefined);
  useEffect(() => { setOPick(undefined); setPPick(undefined); setDPick(undefined); setTPick(undefined); setPrPick(undefined); setProject(''); setCont(undefined); setMgmt(undefined); }, [shared?.fileName, shared?.table]);

  const oCol = oPick === undefined ? find(headers, /^optimi[sz]tic/i) : oPick;
  const pCol = pPick === undefined ? find(headers, /^pessimistic/i) : pPick;
  const dCol = dPick === undefined ? find(headers, /^(depends on|predecessors?|dependencies)$/i) : dPick;
  const tCol = tPick === undefined ? find(headers, /^(issue |work item |item )?type$/i) : tPick;
  const prCol = prPick === undefined ? find(headers, /^project$/i) : prPick;

  const projects = useMemo(() => {
    if (!shared || prCol === null) return [];
    const j = shared.table.headers.indexOf(prCol);
    return [...new Set(shared.table.rows.map((r) => (r[j] ?? '').trim()).filter((v) => v !== ''))].sort();
  }, [shared, prCol]);

  const calc = useMemo(() => {
    if (!shared) return null;
    const rows = shared.table.rows;
    const h = shared.table.headers;
    const jO = oCol === null ? -1 : h.indexOf(oCol);
    const jP = pCol === null ? -1 : h.indexOf(pCol);
    const jD = dCol === null ? -1 : h.indexOf(dCol);
    const jT = tCol === null ? -1 : h.indexOf(tCol);
    const jPr = prCol === null ? -1 : h.indexOf(prCol);
    const rule = { mode: shared.dayCount, holidays: shared.holidays };
    const inScope = (i: number) => project === '' || jPr < 0 || (rows[i]?.[jPr] ?? '').trim() === project;
    const cancelled = (i: number) => shared.items[i]?.statusCategory === 'cancelled';

    // Three-point
    const tpInputs = shared.items.flatMap((it, i) => (inScope(i) && !cancelled(i) && it.statusCategory !== 'done'
      ? [{ id: it.id || `row ${i + 2}`, optimistic: jO < 0 ? null : readNum(rows[i]?.[jO]), mostLikely: shared.hoursTasks[i]?.plannedHours ?? null, pessimistic: jP < 0 ? null : readNum(rows[i]?.[jP]) }]
      : []));
    const three = analyseThreePoint(tpInputs);
    const tpDone = shared.items.filter((it, i) => inScope(i) && it.statusCategory === 'done').length;

    // Critical path
    const notes: string[] = [];
    const tasks: NetworkTask[] = [];
    const meta = new Map<string, { name: string; milestone: boolean; done: boolean }>();
    const noDates: string[] = [];
    const noId: number[] = [];
    let unsupported = 0;
    const keptIds = new Set<string>();
    shared.items.forEach((it, i) => {
      if (!inScope(i) || cancelled(i)) return;
      if (!it.id) { noId.push(i + 2); return; }
      const milestone = jT >= 0 && /milestone/i.test(rows[i]?.[jT] ?? '');
      const s = it.baselineStart, f = it.baselineFinish;
      if (!milestone && (s === null || f === null)) { noDates.push(it.id); return; }
      keptIds.add(it.id);
    });
    let firstStart: string | null = null;
    shared.items.forEach((it, i) => {
      if (!inScope(i) || cancelled(i) || !it.id || !keptIds.has(it.id)) return;
      const milestone = jT >= 0 && /milestone/i.test(rows[i]?.[jT] ?? '');
      const done = it.statusCategory === 'done';
      let duration = 0;
      if (!milestone) {
        const s = it.baselineStart as string, f = it.baselineFinish as string;
        duration = f < s ? -1 : countDays(s, f, rule);
        if (firstStart === null || s < firstStart) firstStart = s;
      } else if (it.baselineStart !== null && (firstStart === null || it.baselineStart < firstStart)) firstStart = it.baselineStart;
      if (view === 'remaining' && done) duration = 0;
      const parsed = parseDependsOn(jD < 0 ? '' : rows[i]?.[jD]);
      unsupported += parsed.unsupported.length;
      tasks.push({ id: it.id, duration, preds: parsed.ids });
      meta.set(it.id, { name: it.name, milestone, done });
    });
    // Links to tasks that were left out (cancelled, no dates, other project) are dropped and listed, never guessed.
    const droppedLinks: string[] = [];
    for (const t of tasks) {
      for (const p of t.preds) if (!keptIds.has(p) && p !== t.id) droppedLinks.push(`${t.id} after ${p}`);
      t.preds = t.preds.filter((p) => keptIds.has(p) || p === t.id);
    }
    const net = tasks.length > 0 ? analyseNetwork(tasks) : null;
    const anyLinks = tasks.some((t) => t.preds.length > 0);
    const startDate = view === 'remaining' ? (shared.statusDate || firstStart) : firstStart;
    const dates = (es: number, ef: number, duration: number) => {
      if (!startDate) return { s: '-', f: '-' };
      // A milestone (no length) happens when its last predecessor finishes, so it shows one date.
      const f = countedDayDate(startDate, Math.max(0, ef - 1), rule);
      return { s: duration === 0 ? f : countedDayDate(startDate, es, rule), f };
    };
    // Latest planned finish in the file, for comparison with the network's finish.
    const plannedFinishes = shared.items.flatMap((it, i) => (inScope(i) && !cancelled(i) && it.baselineFinish !== null ? [it.baselineFinish] : [])).sort();
    const latestPlanned = plannedFinishes.length > 0 ? (plannedFinishes[plannedFinishes.length - 1] as string) : null;
    const networkFinish = net && !net.failed && net.duration > 0 && startDate ? countedDayDate(startDate, net.duration - 1, rule) : null;
    if (noId.length > 0) notes.push(`${noId.length} row${noId.length === 1 ? ' has' : 's have'} no ID and ${noId.length === 1 ? 'was' : 'were'} left out of the critical path (rows ${noId.slice(0, 8).join(', ')}${noId.length > 8 ? ', ...' : ''}).`);
    return { three, tpDone, net, tasks, meta, noDates, droppedLinks, unsupported, anyLinks, dates, latestPlanned, networkFinish, notes, startDate, jD, jO, jP };
  }, [shared, oCol, pCol, dCol, tCol, prCol, project, view]);

  // Reserves
  const settings = shared?.template?.settings ?? null;
  const parseBox = (t: string | undefined, fallback: number | null): number | null => {
    if (t === undefined) return fallback;
    return readNum(t) !== null && (readNum(t) as number) >= 0 ? (readNum(t) as number) : null;
  };
  const contingency = parseBox(cont, settings?.contingency ?? null);
  const management = parseBox(mgmt, settings?.management ?? null);
  const bac = shared?.summary.bac ?? null;
  const ev = shared?.summary.ev ?? null;
  const ac = shared?.summary.ac ?? null;
  const cpi = ev !== null && ac !== null && ac > 0 ? ev / ac : null;
  const eac = bac !== null && cpi !== null && cpi > 0 ? bac / cpi : null;
  const overrun = eac !== null && bac !== null ? Math.max(0, eac - bac) : null;
  const stack = bac !== null ? reserveStack(bac, contingency, management) : null;
  const check = stack ? reserveCheck(stack, overrun) : null;

  return (
    <>
      <h2>Planning</h2>
      <p className="lead">Three-point estimates, the critical path through task dependencies, and the reserves that sit behind the budget.</p>
      {!shared && <NeedsImport onGo={onGoImport} />}
      {shared && calc && (
        <>
          <div className="form">
            <ColumnSelect label="Column with the OPTIMISTIC (best-case) hours" headers={headers} value={oCol} onChange={setOPick} />
            <ColumnSelect label="Column with the PESSIMISTIC (worst-case) hours" headers={headers} value={pCol} onChange={setPPick} />
            <ColumnSelect label='Column with "Depends on" (task IDs that must finish first)' headers={headers} value={dCol} onChange={setDPick} />
            <ColumnSelect label="Column with the item type (milestones take no time)" headers={headers} value={tCol} onChange={setTPick} />
            <ColumnSelect label="Column with the project" headers={headers} value={prCol} onChange={setPrPick} />
            {projects.length > 1 && (
              <label>Project to analyse
                <select value={project} onChange={(e) => setProject(e.target.value)}>
                  <option value="">All projects together</option>
                  {projects.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            )}
          </div>

          <section aria-labelledby="tp-h">
            <h3 id="tp-h">Three-point estimates</h3>
            {oCol === null || pCol === null ? (
              <p className="note">Choose the optimistic and pessimistic columns above (the template has them). The most likely value is each task's planned hours.</p>
            ) : calc.three.used === 0 ? (
              <p className="note">No open task has all three values (optimistic, most likely, pessimistic) in the right order, so nothing can be worked out.</p>
            ) : (
              <>
                <p>
                  <strong>{calc.three.used}</strong> open task{calc.three.used === 1 ? '' : 's'} used. Adding up the most likely values gives <strong>{f1(calc.three.sumMostLikely ?? 0)} h</strong>;
                  adding up the expected values gives <strong>{f1(calc.three.sumExpected ?? 0)} h</strong>. Standard deviation of the total: <strong>{f1(calc.three.sd ?? 0)} h</strong>.
                </p>
                <div className="scroll" tabIndex={0}>
                  <table>
                    <caption>Range for the open work (hours)</caption>
                    <thead><tr><th scope="col">Range</th><th scope="col">From</th><th scope="col">To</th><th scope="col">How to read it</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">Expected ± 1 SD</th><td>{f1(calc.three.range1?.[0] ?? 0)}</td><td>{f1(calc.three.range1?.[1] ?? 0)}</td><td>Roughly two chances in three, if the tasks are independent and the estimates fair.</td></tr>
                      <tr><th scope="row">Expected ± 2 SD</th><td>{f1(calc.three.range2?.[0] ?? 0)}</td><td>{f1(calc.three.range2?.[1] ?? 0)}</td><td>Roughly 19 chances in 20, on the same assumptions.</td></tr>
                    </tbody>
                  </table>
                </div>
                <div className="scroll" tabIndex={0}>
                  <table>
                    <caption>Per task (hours)</caption>
                    <thead><tr><th scope="col">Task</th><th scope="col">Optimistic</th><th scope="col">Most likely</th><th scope="col">Pessimistic</th><th scope="col">Expected</th><th scope="col">SD</th><th scope="col">Note</th></tr></thead>
                    <tbody>
                      {calc.three.rows.map((r) => (
                        <tr key={r.id}>
                          <th scope="row">{r.id}</th>
                          <td>{r.o ?? '-'}</td><td>{r.m ?? '-'}</td><td>{r.p ?? '-'}</td>
                          <td>{r.expected === null ? '-' : f1(r.expected)}</td><td>{r.sd === null ? '-' : f1(r.sd)}</td>
                          <td>{r.used ? '' : r.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="note">
              Expected = (optimistic + 4 × most likely + pessimistic) / 6. Standard deviation = (pessimistic − optimistic) / 6. The total's deviation is the square root of the sum of the squared task deviations, which assumes the tasks do not influence each other.
              {calc.tpDone > 0 ? ` ${calc.tpDone} finished task${calc.tpDone === 1 ? ' is' : 's are'} not included.` : ''} Tasks missing a value are left out and listed, never filled in.
            </p>
          </section>

          <section aria-labelledby="cp-h">
            <h3 id="cp-h">Critical path</h3>
            <div className="form">
              <label>View
                <select value={view} onChange={(e) => setView(e.target.value === 'remaining' ? 'remaining' : 'plan')}>
                  <option value="plan">Whole plan (every task, planned dates)</option>
                  <option value="remaining">Remaining work (finished tasks take no time, counted from the status date)</option>
                </select>
              </label>
            </div>
            {dCol === null && <p className="note">Choose the "Depends on" column above. Without dependencies there is no path to work out.</p>}
            {dCol !== null && !calc.anyLinks && <p className="note">No dependencies were found in that column, so every task could start on day one and nothing is critical.</p>}
            {calc.net && calc.net.problems.length > 0 && (
              <div className="warn" role="note">
                <p>{calc.net.failed ? 'The path could not be worked out:' : 'Please check:'}</p>
                <ul>{calc.net.problems.map((p, i) => <li key={i}>{p.message}</li>)}</ul>
              </div>
            )}
            {calc.net && !calc.net.failed && calc.anyLinks && (
              <>
                <p>
                  The network is <strong>{calc.net.duration}</strong> counted day{calc.net.duration === 1 ? '' : 's'} long
                  {calc.networkFinish ? <>, finishing on <strong>{calc.networkFinish}</strong></> : ''}.
                  {calc.latestPlanned ? <> The latest planned finish in the file is <strong>{calc.latestPlanned}</strong>.</> : ''}{' '}
                  <strong>{calc.net.rows.filter((r) => r.critical).length}</strong> task{calc.net.rows.filter((r) => r.critical).length === 1 ? ' is' : 's are'} on the critical path.
                </p>
                <div className="scroll" tabIndex={0}>
                  <table>
                    <caption>Earliest dates, float and critical tasks</caption>
                    <thead><tr><th scope="col">Task</th><th scope="col">Name</th><th scope="col">Days</th><th scope="col">Earliest start</th><th scope="col">Earliest finish</th><th scope="col">Total float</th><th scope="col">Free float</th><th scope="col">Critical</th><th scope="col">After</th></tr></thead>
                    <tbody>
                      {calc.net.rows.map((r) => {
                        const d = calc.dates(r.es, r.ef, r.duration);
                        const finished = view === 'remaining' && calc.meta.get(r.id)?.done === true && !calc.meta.get(r.id)?.milestone;
                        return (
                          <tr key={r.id} className={r.critical ? 'rag-red' : undefined}>
                            <th scope="row">{r.id}</th>
                            <td>{calc.meta.get(r.id)?.name ?? ''}</td>
                            <td>{r.duration}</td><td>{finished ? 'done' : d.s}</td><td>{finished ? 'done' : d.f}</td>
                            <td>{r.totalFloat}</td><td>{r.freeFloat}</td>
                            <td>{r.critical ? 'Yes' : 'No'}</td>
                            <td>{r.preds.join(', ') || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="note">
              Forward pass: a task starts when its last predecessor finishes. Backward pass: a task may finish as late as its earliest successor needs. Total float = how long a task can slip without moving the project finish; free float = how long it can slip without moving the next task. Critical = total float 0.
              Task length is the number of counted days between its planned start and finish (inclusive), using your Weekdays or All days setting and holidays.
            </p>
            <ul className="note">
              <li>Only finish-to-start links with no lag are used. Start-to-start, finish-to-finish, lags and leads are not worked out.</li>
              <li>Dependencies are never inferred from dates; only what the "Depends on" column says is used.</li>
              {view === 'remaining' && <li>In the remaining-work view a started task still counts its full planned length; no part of it is credited.</li>}
              {view === 'plan' && <li>The whole-plan view dates the network from the earliest planned start and ignores progress.</li>}
            </ul>
            {(calc.noDates.length > 0 || calc.droppedLinks.length > 0 || calc.unsupported > 0 || calc.notes.length > 0) && (
              <div className="note">
                <p>Left out and not guessed:</p>
                <ul>
                  {calc.noDates.length > 0 && <li>{calc.noDates.length} task{calc.noDates.length === 1 ? '' : 's'} without both planned dates ({calc.noDates.slice(0, 10).join(', ')}{calc.noDates.length > 10 ? ', ...' : ''}). Links to them were dropped, which can make the path look shorter than it is.</li>}
                  {calc.droppedLinks.length > 0 && <li>{calc.droppedLinks.length} link{calc.droppedLinks.length === 1 ? '' : 's'} to a task that is cancelled, left out or in another project: {calc.droppedLinks.slice(0, 6).join('; ')}{calc.droppedLinks.length > 6 ? '; ...' : ''}.</li>}
                  {calc.unsupported > 0 && <li>{calc.unsupported} dependency entr{calc.unsupported === 1 ? 'y' : 'ies'} written with a lag, lead or link type, which is not supported.</li>}
                  {calc.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
          </section>

          <section aria-labelledby="rs-h">
            <h3 id="rs-h">Contingency and management reserve</h3>
            <div className="form">
              <label>Contingency reserve (h) — inside the cost baseline, for known risks
                <input type="text" inputMode="decimal" value={cont ?? (settings?.contingency ?? '')} onChange={(e) => setCont(e.target.value)} />
              </label>
              <label>Management reserve (h) — above the baseline, for unknown risks
                <input type="text" inputMode="decimal" value={mgmt ?? (settings?.management ?? '')} onChange={(e) => setMgmt(e.target.value)} />
              </label>
            </div>
            {bac === null || !stack ? (
              <p className="note">The planned hours (budget at completion) could not be worked out, so the reserves cannot be placed on top of them.</p>
            ) : (
              <>
                <div className="scroll" tabIndex={0}>
                  <table>
                    <caption>How the budget is built up (hours)</caption>
                    <thead><tr><th scope="col">Layer</th><th scope="col">Hours</th><th scope="col">Who controls it</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">Work estimate (budget at completion)</th><td>{f1(stack.estimate)}</td><td>Project manager</td></tr>
                      <tr><th scope="row">+ Contingency reserve</th><td>{stack.contingency === null ? 'not entered' : f1(stack.contingency)}</td><td>Project manager</td></tr>
                      <tr><th scope="row">= Cost baseline</th><td>{stack.costBaseline === null ? '-' : f1(stack.costBaseline)}</td><td>Project manager</td></tr>
                      <tr><th scope="row">+ Management reserve</th><td>{stack.management === null ? 'not entered' : f1(stack.management)}</td><td>Sponsor</td></tr>
                      <tr><th scope="row">= Project budget</th><td>{stack.budget === null ? '-' : f1(stack.budget)}</td><td>Sponsor</td></tr>
                    </tbody>
                  </table>
                </div>
                {check && (
                  <p role="note" className={check.state === 'exceeds_budget' || check.state === 'needs_management' ? 'warn' : undefined}>
                    {overrun !== null && eac !== null
                      ? <>At today's cost performance (CPI {cpi === null ? '-' : (Math.round(cpi * 100) / 100).toFixed(2)}) the work is expected to cost <strong>{f1(eac)} h</strong>, an overrun of <strong>{f1(overrun)} h</strong> over the estimate. </>
                      : null}
                    {RESERVE_TEXT[check.state]}
                    {check.contingencyShare !== null && overrun !== null && overrun > 0 ? ` That overrun would use ${roundHalfUp(check.contingencyShare * 100, 0)}% of the contingency reserve.` : ''}
                    {check.fromManagement > 0 ? ` ${f1(check.fromManagement)} h would need the management reserve.` : ''}
                    {check.beyondBudget > 0 ? ` ${f1(check.beyondBudget)} h would be beyond the whole budget.` : ''}
                  </p>
                )}
              </>
            )}
            <p className="note">
              Reserve sizes are your decision: the app never suggests or fills them in. Blank means "not entered", which is different from 0. The overrun uses the usual "typical" forecast, estimate / CPI, which assumes today's cost performance continues; it is a rule of thumb, not a prediction.
            </p>
          </section>
        </>
      )}
    </>
  );
}
