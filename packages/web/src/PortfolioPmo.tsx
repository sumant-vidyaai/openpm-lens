import { useMemo } from 'react';
import {
  DEFAULT_RISK_BANDS, NO_PROJECT_NAMED, portfolioCapacity, portfolioRisks, priorityView, resourceTasksForTable, roundHalfUp, toCsv, RISK_BAND_LABEL,
  type AnalyseSettings, type CsvCell, type CsvResult, type RiskInput, type Unit,
} from '@spashta/core';
import { suggestAssignee } from './common';
import { HeatMap } from './Raid';

export interface PrioState { criteria: { name: string; weight: string }[]; scores: Record<string, Record<string, string>> }
export interface PmoSet { project: string; table: CsvResult; unit: Unit | '' }
export interface PmoProps {
  sets: PmoSet[];
  settings: AnalyseSettings;
  statusDate: string;
  prio: PrioState;
  onPrio: (p: PrioState) => void;
  capText: string;
  overText: string;
  onCap: (v: string) => void;
  onOver: (v: string) => void;
  risks: RiskInput[];
  riskBands: { mediumMin: number; highMin: number } | null;
}

const num = (s: string | undefined): number | null => { const t = (s ?? '').trim(); if (t === '') return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
const r2 = (n: number | null) => (n === null ? '-' : String(roundHalfUp(n, 2)));
const pct = (n: number | null) => (n === null ? '-' : `${roundHalfUp(n, 0)}%`);

export function PortfolioPmo({ sets, settings, statusDate, prio, onPrio, capText, overText, onCap, onOver, risks, riskBands }: PmoProps) {
  const names = sets.map((s) => s.project);

  /* ---- priority ---- */
  const criteria = prio.criteria.map((c) => ({ name: c.name.trim(), weight: num(c.weight) })).filter((c) => c.name !== '');
  const weightBad = prio.criteria.filter((c) => c.name.trim() !== '' && c.weight.trim() !== '' && !(num(c.weight) !== null && (num(c.weight) as number) > 0)).map((c) => c.name.trim());
  const scoreRows = useMemo(
    () => Object.entries(prio.scores).map(([option, m]) => ({ option, scores: Object.fromEntries(criteria.map((c) => [c.name, num(m[c.name])])) })),
    [prio.scores, prio.criteria], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const scoreBad = Object.entries(prio.scores).flatMap(([p, m]) => Object.entries(m).filter(([, v]) => v.trim() !== '' && num(v) === null).map(([c]) => `${p} / ${c}`));
  const pv = useMemo(() => priorityView(names, criteria, scoreRows), [names.join('|'), scoreRows, prio.criteria]); // eslint-disable-line react-hooks/exhaustive-deps
  const setCrit = (i: number, patch: Partial<{ name: string; weight: string }>) => {
    const old = prio.criteria[i]?.name ?? '';
    const next = prio.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c));
    let scores = prio.scores;
    if (patch.name !== undefined && patch.name !== old) {
      scores = Object.fromEntries(Object.entries(scores).map(([p, m]) => { const { [old]: v, ...rest } = m; return [p, v === undefined ? rest : { ...rest, [patch.name as string]: v }]; }));
    }
    onPrio({ criteria: next, scores });
  };
  const setScore = (project: string, crit: string, v: string) => onPrio({ ...prio, scores: { ...prio.scores, [project]: { ...(prio.scores[project] ?? {}), [crit]: v } } });
  const scoreProjects = [...new Set([...names, ...Object.keys(prio.scores)])];

  /* ---- capacity ---- */
  const cap = num(capText), ov = num(overText);
  const capOk = cap !== null && cap > 0 && ov !== null && ov > 0;
  const cols = useMemo(() => sets.map((s) => suggestAssignee(s.table.headers)), [sets]);
  const capacity = useMemo(() => {
    if (!capOk) return null;
    const taskSets = sets.map((s, i) => ({ project: s.project, tasks: resourceTasksForTable(s.table, { ...settings, unitOverride: s.unit === '' ? null : s.unit }, cols[i] ?? null, s.project) }));
    return portfolioCapacity(taskSets, { capacityDefault: cap as number, capacityByPerson: {}, mode: { mode: settings.dayCount, holidays: settings.holidays }, overPercent: ov as number });
  }, [sets, settings, cols, capOk, cap, ov]);

  /* ---- risks ---- */
  const bands = riskBands ?? DEFAULT_RISK_BANDS;
  const pr = useMemo(() => portfolioRisks(risks, statusDate === '' ? null : statusDate, bands), [risks, statusDate, bands.mediumMin, bands.highMin]); // eslint-disable-line react-hooks/exhaustive-deps
  const known = new Set(names.map((n) => n.trim().toLowerCase()));
  const projLabel = (p: string) => (p === NO_PROJECT_NAMED || known.has(p.trim().toLowerCase()) ? p : `${p} (not among the loaded projects)`);

  function download() {
    const rows: CsvCell[][] = [
      ['Priority score (weighted: sum of weight x score / sum of weights)'],
      ['Rank', 'Project', 'Score', 'Missing scores'],
      ...pv.rows.map((r): CsvCell[] => [r.rank, r.option, r.score === null ? null : roundHalfUp(r.score, 4), r.missing.join('; ')]),
      [],
      ['Demand against capacity', capacity === null ? 'Enter weekly hours per person to see this' : `${capText} hours per person per week; flagged above ${overText}%`],
      ['Person', 'Planned hours', 'By project', 'Peak week %', 'Weeks over the limit'],
      ...(capacity?.split.map((s): CsvCell[] => {
        const p = capacity.result.people.find((x) => x.person.toLowerCase() === s.person.toLowerCase());
        return [s.person, roundHalfUp(s.total, 4), s.byProject.map((b) => `${b.project}: ${roundHalfUp(b.hours, 2)}`).join('; '), p?.peak == null ? null : roundHalfUp(p.peak, 1), p?.overWeeks ?? null];
      }) ?? []),
      [],
      ['Week (starts Monday)', 'Planned hours, all people named', 'Capacity hours', 'Utilisation %'],
      ...(capacity?.weekTotals.map((w): CsvCell[] => [w.weekStart, roundHalfUp(w.planned, 4), roundHalfUp(w.capacity, 4), w.utilisation === null ? null : roundHalfUp(w.utilisation, 2)]) ?? []),
      [],
      ['Open risks by project'],
      ['Project', 'High', 'Medium', 'Low', 'Not scored', 'Overdue actions'],
      ...pr.perProject.map((p): CsvCell[] => [p.project, p.high, p.medium, p.low, p.unscored, p.overdueActions]),
      [],
      ['Highest open risks'],
      ['Project', 'Risk', 'Score', 'Band', 'Owner'],
      ...pr.top.map((t): CsvCell[] => [t.project, t.title, t.score, t.band === null ? null : RISK_BAND_LABEL[t.band], t.owner]),
      [],
      ['Status date', statusDate || 'not chosen'],
      ['Report made on', new Date().toLocaleDateString('en-CA')],
    ];
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `spashta-portfolio-pmo-${statusDate || new Date().toLocaleDateString('en-CA')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <h3>6. Priorities, demand against capacity, and risks across projects</h3>
      <p className="note">Everything here comes from numbers you type or load. Weights, scores, weekly hours and risk limits are your judgement, so nothing is filled in for you.</p>
      <div className="row noprint"><button type="button" onClick={download}>Download this section (CSV)</button></div>

      <h4>Priority score</h4>
      <p className="note">Give each criterion a weight (any positive number) and score each project on it, on your own scale. A project's score = sum of (weight x score) divided by the sum of the weights. A project missing a score is left unscored, not counted as zero.</p>
      <div className="scroll" tabIndex={0}>
        <table>
          <caption>Criteria and scores</caption>
          <thead>
            <tr><th>Criterion</th><th>Weight</th>{scoreProjects.map((p) => <th key={p} scope="col">{p}</th>)}<th><span className="sr">Remove</span></th></tr>
          </thead>
          <tbody>
            {prio.criteria.map((c, i) => (
              <tr key={i}>
                <td><input aria-label={`Criterion ${i + 1} name`} value={c.name} onChange={(e) => setCrit(i, { name: e.target.value })} /></td>
                <td><input aria-label={`Weight for ${c.name || `criterion ${i + 1}`}`} inputMode="decimal" value={c.weight} onChange={(e) => setCrit(i, { weight: e.target.value })} /></td>
                {scoreProjects.map((p) => (
                  <td key={p}><input aria-label={`${p}: score for ${c.name || `criterion ${i + 1}`}`} inputMode="decimal" value={prio.scores[p]?.[c.name.trim()] ?? ''} disabled={c.name.trim() === ''} onChange={(e) => setScore(p, c.name.trim(), e.target.value)} /></td>
                ))}
                <td><button type="button" aria-label={`Remove criterion ${c.name || i + 1}`} onClick={() => onPrio({ ...prio, criteria: prio.criteria.filter((_, j) => j !== i) })}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row noprint"><button type="button" onClick={() => onPrio({ ...prio, criteria: [...prio.criteria, { name: '', weight: '' }] })}>Add a criterion</button></div>
      {weightBad.length > 0 && <p className="warn" role="alert">Weight for {weightBad.join(', ')} is not a positive number; that criterion is left out.</p>}
      {scoreBad.length > 0 && <p className="warn" role="alert">Not a number, treated as not scored: {scoreBad.join('; ')}.</p>}
      {pv.criteriaUsed === 0 ? (
        <p className="note">Add at least one criterion with a weight to see the ranking.</p>
      ) : (
        <div className="scroll" tabIndex={0}>
          <table>
            <caption>Projects ranked by priority score (higher first)</caption>
            <thead><tr><th>Rank</th><th>Project</th><th>Score</th><th>Note</th></tr></thead>
            <tbody>
              {pv.rows.map((r) => (
                <tr key={r.option}>
                  <td>{r.rank ?? '-'}</td><th scope="row">{r.option}</th><td>{r2(r.score)}</td>
                  <td>{r.missing.length > 0 ? `Not scored: missing ${r.missing.join(', ')}` : ''}{!r.inPortfolio ? ' Not among the loaded projects.' : ''}</td>
                </tr>
              ))}
              {pv.notScored.map((n) => <tr key={`ns-${n}`}><td>-</td><th scope="row">{n}</th><td>-</td><td>No scores entered</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
      {pv.ignored.length > 0 && <p className="note">Left out because they have no positive weight: {pv.ignored.join(', ')}.</p>}
      <details className="explain"><summary>How the priority score works</summary>
        <ul>
          <li>Score = sum of (weight x score) / sum of weights, over the criteria with a positive weight. With weights {pv.criteriaUsed === 0 ? '(none yet)' : `adding to ${r2(pv.weightTotal)}`}, any scale works.</li>
          <li>Equal scores share a rank. The app does not suggest weights or scales; they are the PMO's decision.</li>
          <li>The score ranks projects against each other. It does not decide which to fund.</li>
        </ul>
      </details>

      <h4>Demand against capacity</h4>
      <div className="form">
        <label>Hours one person can work in a week<input inputMode="decimal" value={capText} onChange={(e) => onCap(e.target.value)} placeholder="your own figure" /></label>
        <label>Flag a week above this % of capacity<input inputMode="decimal" value={overText} onChange={(e) => onOver(e.target.value)} /></label>
      </div>
      {capacity === null ? (
        <p className="note">Enter the weekly hours per person to see who is over capacity once all projects are added together. Tasks need an assignee column, planned hours and planned dates.</p>
      ) : (
        <>
          {capacity.projectsWithoutAssignee.length > 0 && <p className="warn" role="status">No assignee column was found for {capacity.projectsWithoutAssignee.join(', ')}, or the file cannot be read yet, so those projects are left out here.</p>}
          {capacity.overOnlyCombined.length > 0 && (
            <p className="band band-amber" role="status">Over the limit only when projects are added together: <strong>{capacity.overOnlyCombined.join(', ')}</strong>. No single project puts them over.</p>
          )}
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>People across all projects (planned hours of tasks naming one person)</caption>
              <thead><tr><th>Person</th><th>Planned hours</th><th>Hours by project</th><th>Peak week</th><th>Weeks over the limit</th></tr></thead>
              <tbody>
                {capacity.split.map((s) => {
                  const p = capacity.result.people.find((x) => x.person.toLowerCase() === s.person.toLowerCase());
                  return (
                    <tr key={s.person}>
                      <th scope="row">{s.person}</th><td>{r2(s.total)}</td>
                      <td>{s.byProject.map((b) => `${b.project}: ${r2(b.hours)}`).join('; ')}</td>
                      <td>{p?.peak == null ? '-' : pct(p.peak)}</td><td>{p?.overWeeks ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Everyone together, by week (weeks start on Monday)</caption>
              <thead><tr><th>Week of</th><th>Planned hours</th><th>Capacity hours</th><th>Utilisation</th></tr></thead>
              <tbody>
                {capacity.weekTotals.map((w) => (
                  <tr key={w.weekStart}><th scope="row">{w.weekStart}</th><td>{r2(w.planned)}</td><td>{r2(w.capacity)}</td><td>{pct(w.utilisation)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="explain"><summary>How demand against capacity works</summary>
            <ul>
              <li>Each task's planned hours are spread evenly over its planned working days, then added up per person per week across all projects.</li>
              <li>Utilisation = planned hours / capacity. For everyone together both are added first, then divided (percentages are never averaged).</li>
              <li>Tasks naming several people, tasks with no planned hours or dates, and unassigned work ({r2(capacity.unassignedHours)} planned hours) are not given to anyone. {capacity.result.excluded.length} task{capacity.result.excluded.length === 1 ? '' : 's'} left out of some figures.</li>
              <li>Every person gets the same weekly hours and holidays come from the settings above; leave and personal capacity are on the Resources tab for one project.</li>
            </ul>
          </details>
        </>
      )}

      <h4>Risks across projects</h4>
      {risks.length === 0 ? (
        <p className="note">No risks loaded. Add a Risks sheet to the template with a Project column and upload it here.</p>
      ) : (
        <>
          <HeatMap heat={pr.overall.heat} bands={bands} />
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Open risks by project (worst first)</caption>
              <thead><tr><th>Project</th><th>High</th><th>Medium</th><th>Low</th><th>Not scored</th><th>Overdue actions</th></tr></thead>
              <tbody>
                {pr.perProject.map((p) => (
                  <tr key={p.project}><th scope="row">{projLabel(p.project)}</th><td>{p.high}</td><td>{p.medium}</td><td>{p.low}</td><td>{p.unscored}</td><td>{p.overdueActions}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {pr.top.length > 0 && (
            <div className="scroll" tabIndex={0}>
              <table>
                <caption>Highest open risks across all projects</caption>
                <thead><tr><th>Project</th><th>Risk</th><th>Score</th><th>Band</th><th>Owner</th></tr></thead>
                <tbody>
                  {pr.top.slice(0, 10).map((t, i) => (
                    <tr key={`${t.project}-${t.id}-${i}`}><th scope="row">{projLabel(t.project)}</th><td>{t.title}</td><td>{t.score}</td><td>{t.band === null ? '-' : RISK_BAND_LABEL[t.band]}</td><td>{t.owner || 'No owner'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">Score = probability x impact. Medium from {bands.mediumMin}, high from {bands.highMin}{riskBands === null ? ' (starting values, not a standard; set them in the template Settings)' : " (from the template's Settings sheet)"}. Closed and occurred risks are not counted. Showing the top {Math.min(10, pr.top.length)} of {pr.top.length}.</p>
        </>
      )}
    </>
  );
}
