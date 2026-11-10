import { useMemo } from 'react';
import {
  HEALTH_LABEL, NO_PHASE, parsePhaseOrder, portfolioQuality, stageGateView, toCsv, updateDiscipline,
  type CsvCell, type GateProject, type Health, type HealthThresholds, type PortfolioProject, type RegisterRow, type UpdateState,
} from '@spashta/core';

const SYMBOL: Record<Health, string> = { green: '●', amber: '▲', red: '■', insufficient: '○' };
function Rag({ health }: { health: Health }) {
  return <span className={`rag rag-${health}`}><span aria-hidden="true">{SYMBOL[health]}</span> {HEALTH_LABEL[health]}</span>;
}

const gateText = (g: GateProject): string => {
  if (g.nextGate === null) return 'No gate date';
  if (g.gateState === 'unknown') return `${g.nextGate} (choose a status date to compare)`;
  if (g.gateState === 'passed') return `${g.nextGate}: date passed ${g.gateDays} day${g.gateDays === 1 ? '' : 's'} ago`;
  return g.gateDays === 0 ? `${g.nextGate}: on the status date` : `${g.nextGate}: in ${g.gateDays} day${g.gateDays === 1 ? '' : 's'}`;
};
const updateText = (s: UpdateState, due: number | null): string => ({
  on_time: 'On time', overdue: `Overdue (more than ${due} days)`, not_judged: 'Not judged (enter a limit above)', no_date: 'No update date', after_status_date: 'Dated after the status date',
}[s]);

export interface ControlProps {
  projects: PortfolioProject[];
  register: RegisterRow[];
  statusDate: string;
  thresholds: HealthThresholds;
  phaseOrderText: string;
  dueText: string;
  onPhaseOrder: (v: string) => void;
  onDue: (v: string) => void;
}

export function PortfolioControl({ projects, register, statusDate, thresholds, phaseOrderText, dueText, onPhaseOrder, onDue }: ControlProps) {
  const phaseOrder = useMemo(() => parsePhaseOrder(phaseOrderText), [phaseOrderText]);
  const dueNum = dueText.trim() === '' ? null : Number(dueText);
  const dueBad = dueNum !== null && !(Number.isInteger(dueNum) && dueNum >= 1 && dueNum <= 365);
  const due = dueBad ? null : dueNum;
  const sd = statusDate === '' ? null : statusDate;
  const view = useMemo(() => stageGateView(register, projects, phaseOrder, sd, thresholds), [register, projects, phaseOrder, sd, thresholds]);
  const disc = useMemo(() => updateDiscipline(register, sd, due), [register, sd, due]);
  const quality = useMemo(() => portfolioQuality(projects), [projects]);

  function download() {
    const rows: CsvCell[][] = [
      ['Stage-gate view'],
      ['Phase', 'Project', 'Project manager', 'Next gate', 'Gate state', 'Days', 'Has task numbers'],
      ...view.phases.flatMap((p) => (p.projects.length === 0 ? [[p.phase, '(no projects)', '', '', '', '', '']] : p.projects.map((g): CsvCell[] => [p.phase, g.project, g.manager, g.nextGate, g.gateState, g.gateDays, g.hasNumbers ? 'yes' : 'no']))),
      [],
      ['Reporting discipline', due === null ? 'No limit entered: nothing is called overdue' : `Overdue when more than ${due} days old at the status date`],
      ['Project', 'Project manager', 'Last updated', 'Days since update (to status date)', 'State'],
      ...disc.rows.map((r): CsvCell[] => [r.project, r.manager, r.lastUpdated, r.daysSince, updateText(r.state, due)]),
      [],
      ['Data quality (lowest first; scores are not averaged)'],
      ['Project', 'Score (0-100)', 'Tasks', 'Most common problem', 'Reading'],
      ...quality.rows.map((r): CsvCell[] => [r.name, r.score, r.tasks, r.topProblem, r.reason]),
      [],
      ['Status date', statusDate || 'not chosen'],
      ['Report made on', new Date().toLocaleDateString('en-CA')],
    ];
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `spashta-portfolio-control-${statusDate || new Date().toLocaleDateString('en-CA')}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const hasRegister = register.length > 0;
  return (
    <>
      <h3>5. Phases, update discipline and data quality</h3>
      <p className="note">
        These views use the optional <strong>Projects</strong> sheet of the template (project, phase, project manager, last updated, next gate).
        The phase names, their order and how many days make an update late are your own: nothing is filled in for you.
      </p>
      <div className="form">
        <label>Phases in order (your own list, separated by commas)
          <input value={phaseOrderText} onChange={(e) => onPhaseOrder(e.target.value)} placeholder="Idea, Plan, Build, Test, Launch" />
        </label>
        <label>An update is overdue when older than this many days (at the status date)
          <input type="number" min={1} max={365} step={1} value={dueText} onChange={(e) => onDue(e.target.value)} />
          {dueBad && <span className="warn" role="alert">Enter a whole number from 1 to 365, or leave it blank. Nothing is called overdue until you do.</span>}
        </label>
      </div>

      {!hasRegister ? (
        <p className="note">No Projects sheet has been read yet, so the phase and update views are empty. Add a filled template that has a Projects sheet, or try the made-up projects. Data quality is shown below for every loaded project.</p>
      ) : (
        <>
          <h4>Stage-gate view</h4>
          <p className="note">
            A stage-gate process splits work into phases with a decision point (a gate) between them. Here each project sits in the phase you named, with its next gate date compared with the status date.
            A date that has passed only means the date has passed: this view cannot tell whether the gate decision was made.
            {view.orderFromData && ' No phase order was typed, so phases are shown in the order they were found.'}
            {sd === null && ' Choose a status date to compare gate dates.'}
          </p>
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Projects by phase</caption>
              <thead><tr><th>Phase</th><th>Projects</th><th>Health of projects with numbers</th><th>Gate dates passed</th></tr></thead>
              <tbody>
                {view.phases.map((p) => (
                  <tr key={p.phase}>
                    <th scope="row">{p.phase}</th>
                    <td>{p.projects.length}{p.projects.length === 0 && p.fromOrder ? ' (none yet)' : ''}</td>
                    <td>{p.rollup ? <Rag health={p.rollup.health.health} /> : p.projects.length === 0 ? '-' : 'No task numbers'}</td>
                    <td>{p.gatesPassed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Each project and its next gate</caption>
              <thead><tr><th>Project</th><th>Phase</th><th>Project manager</th><th>Next gate</th><th>Task numbers</th></tr></thead>
              <tbody>
                {view.phases.flatMap((p) => p.projects.map((g) => (
                  <tr key={`${p.phase}-${g.project}`}>
                    <th scope="row">{g.project}</th><td>{p.phase === NO_PHASE ? NO_PHASE : p.phase}</td><td>{g.manager || '-'}</td><td>{gateText(g)}</td>
                    <td>{g.hasNumbers ? 'Loaded' : 'Not loaded'}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
          {view.notInRegister.length > 0 && <p className="warn" role="status">Loaded but not in the Projects sheet (so no phase is known): {view.notInRegister.join(', ')}.</p>}

          <h4>Who has not updated</h4>
          <p className="note">
            Days are counted from each project's last-updated date to the status date. {due === null ? 'No limit is entered, so nothing is called overdue yet.' : `An update is overdue when it is more than ${due} days old; exactly ${due} days is on time.`}
            {sd === null && ' Choose a status date to count days.'} A blank date is shown as "No update date", never as on time or late.
          </p>
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>By project manager</caption>
              <thead><tr><th>Project manager</th><th>Projects</th><th>Overdue</th><th>No update date</th><th>Dated after status date</th><th>Longest gap (days)</th></tr></thead>
              <tbody>
                {disc.managers.map((m) => (
                  <tr key={m.manager}><th scope="row">{m.manager}</th><td>{m.projects}</td><td>{disc.judged ? m.overdue : '-'}</td><td>{m.noDate}</td><td>{m.afterStatusDate}</td><td>{m.longestGapDays ?? '-'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Each project, oldest update first</caption>
              <thead><tr><th>Project</th><th>Project manager</th><th>Last updated</th><th>Days since</th><th>State</th></tr></thead>
              <tbody>
                {disc.rows.map((r) => (
                  <tr key={r.project}><th scope="row">{r.project}</th><td>{r.manager}</td><td>{r.lastUpdated ?? '-'}</td><td>{r.daysSince ?? '-'}</td><td>{updateText(r.state, due)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h4>Data quality by project</h4>
      <p className="note">
        Each project's own score is the share of its tasks that could be used in the earned-value numbers. Projects are listed lowest first, so fix those first.
        Scores are not averaged into one number, and a project with too few tasks is not scored.
        {quality.scored > 0 && ` ${quality.scored} scored (lowest ${quality.lowest}, highest ${quality.highest}); ${quality.notScored} not scored.`}
      </p>
      <div className="scroll" tabIndex={0}>
        <table>
          <caption>Data quality, lowest first</caption>
          <thead><tr><th>Project</th><th>Score (0 to 100)</th><th>Tasks</th><th>Most common problem</th><th>Reading</th></tr></thead>
          <tbody>
            {quality.rows.map((r) => (
              <tr key={r.id}><th scope="row">{r.name}</th><td>{r.score ?? 'Not scored'}</td><td>{r.tasks}</td><td>{r.topProblem ?? '-'}</td><td>{r.reason}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="noprint"><button type="button" onClick={download}>Download these tables (CSV)</button></p>
      <details className="explain">
        <summary>How these views work</summary>
        <ul>
          <li>Phase health adds the hours of the phase's projects first, then works out CPI and SPI from the totals (ratios are never averaged).</li>
          <li>Days since update = status date minus last-updated date, in whole calendar days.</li>
          <li>Matching a project to its tasks ignores capital letters and spaces at the ends of the name.</li>
        </ul>
      </details>
    </>
  );
}
