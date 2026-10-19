import { useMemo } from 'react';
import {
  analyseChanges, analyseIssues, analyseRisks, bandOf, DEFAULT_RISK_BANDS, RISK_BAND_LABEL, roundHalfUp,
  type CsvCell, type RiskBand,
} from '@openpm-lens/core';
import { NeedsImport, saveCsv } from './common';
import type { SharedData } from './shared';

const BAND_SYMBOL: Record<RiskBand, string> = { low: '●', medium: '▲', high: '■' };
const BAND_CLASS: Record<RiskBand, string> = { low: 'rag-green', medium: 'rag-amber', high: 'rag-red' };
const f1 = (n: number | null) => (n === null ? 'not available' : String(roundHalfUp(n, 1)));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** One place that turns the template's three optional sheets into results, shared by the RAID tab and the Overview panel. */
export function useRaid(shared: SharedData | null) {
  return useMemo(() => {
    if (!shared || !shared.raid) return null;
    const st = shared.template?.settings ?? null;
    const bands = {
      mediumMin: st?.riskMediumMin ?? DEFAULT_RISK_BANDS.mediumMin,
      highMin: st?.riskHighMin ?? DEFAULT_RISK_BANDS.highMin,
    };
    const date = shared.statusDate || null;
    const { risks, issues, changes } = shared.raid;
    return {
      bands, date, bandsFromTemplate: st?.riskMediumMin != null && st?.riskHighMin != null,
      budget: st?.originalBudget ?? null,
      risks: risks.present ? analyseRisks(risks.risks, date, bands) : null,
      issues: issues.present ? analyseIssues(issues.issues, date) : null,
      changes: changes.present ? analyseChanges(changes.changes, date, st?.originalBudget ?? null) : null,
      problems: [...risks.problems, ...issues.problems, ...changes.problems],
    };
  }, [shared]);
}
type Raid = NonNullable<ReturnType<typeof useRaid>>;

function HeatMap({ heat, bands }: { heat: number[][]; bands: { mediumMin: number; highMin: number } }) {
  return (
    <div className="scroll" tabIndex={0}>
      <table className="heat">
        <caption>Open risks by probability and impact. Each box shows how many open risks sit there; the letter is the band of that box (L low, M medium, H high).</caption>
        <thead>
          <tr><td className="corner" /><th scope="col" colSpan={5}>Probability (1 rare to 5 almost certain)</th></tr>
          <tr><td className="corner" />{[1, 2, 3, 4, 5].map((p) => <th key={p} scope="col">{p}</th>)}</tr>
        </thead>
        <tbody>
          {[5, 4, 3, 2, 1].map((imp) => (
            <tr key={imp}>
              <th scope="row">Impact {imp}</th>
              {[1, 2, 3, 4, 5].map((p) => {
                const band = bandOf(p * imp, bands.mediumMin, bands.highMin);
                const n = heat[imp - 1]?.[p - 1] ?? 0;
                return (
                  <td key={p} className={BAND_CLASS[band]}>
                    <span className="heat-n">{n}</span> <span className="heat-b" aria-hidden="true">{BAND_SYMBOL[band]}{RISK_BAND_LABEL[band].charAt(0)}</span>
                    <span className="sr-only"> {RISK_BAND_LABEL[band]} band, score {p * imp}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskSection({ r, raid }: { r: NonNullable<Raid['risks']>; raid: Raid }) {
  const open = r.openCounts.high + r.openCounts.medium + r.openCounts.low + r.openUnscored;
  return (
    <section aria-labelledby="rk-h">
      <h3 id="rk-h">Risks</h3>
      <p className="note">Score = probability x impact, each 1 to 5, so 1 to 25. The score only orders risks: scores are never added together. Bands: Low below {raid.bands.mediumMin}, Medium {raid.bands.mediumMin} to {raid.bands.highMin - 1}, High {raid.bands.highMin} and above. These are starting values, not a standard{raid.bandsFromTemplate ? ' (set on the Settings sheet)' : ''}.</p>
      <p>
        {plural(open, 'open risk')}: {r.openCounts.high} high, {r.openCounts.medium} medium, {r.openCounts.low} low{r.openUnscored > 0 ? `, ${r.openUnscored} not scored` : ''}.
        {' '}{r.overdueActions > 0 ? `${plural(r.overdueActions, 'open risk')} with an action past its date and not done.` : raid.date ? 'No open action is past its date.' : 'Choose a status date to check overdue actions.'}
        {' '}{r.closed} closed, {r.occurred} occurred{r.statusUnknown > 0 ? `, ${r.statusUnknown} with no status` : ''}.
      </p>
      <HeatMap heat={r.heat} bands={raid.bands} />
      {(r.openUnscored > 0 || r.openNoOwner > 0 || r.openNoResponse > 0) && (
        <p className="note">Needs attention: {r.openUnscored} open without a score, {r.openNoOwner} open with no owner, {r.openNoResponse} open with no response or action. They are listed below, not guessed.</p>
      )}
      <div className="scroll" tabIndex={0}>
        <table>
          <caption>Risks, open ones first, highest score first</caption>
          <thead><tr><th scope="col">Risk</th><th scope="col">Score</th><th scope="col">Owner</th><th scope="col">Response</th><th scope="col">Status</th><th scope="col">Action (due)</th></tr></thead>
          <tbody>
            {r.rows.map((x, i) => (
              <tr key={`${x.id}-${i}`}>
                <th scope="row">{x.id} {x.title}</th>
                <td className={x.band && x.status === 'open' ? BAND_CLASS[x.band] : undefined}>
                  {x.score === null ? 'not scored' : <><span aria-hidden="true">{BAND_SYMBOL[x.band as RiskBand]} </span>{x.score} ({x.probability} x {x.impact}), {RISK_BAND_LABEL[x.band as RiskBand]}</>}
                </td>
                <td>{x.owner || 'none'}</td>
                <td>{x.response || '-'}</td>
                <td>{x.status === null ? 'not known' : x.status.charAt(0).toUpperCase() + x.status.slice(1)}</td>
                <td>
                  {x.action || '-'}{x.actionDue ? ` (due ${x.actionDue}${x.actionDone ? `, done ${x.actionDone}` : ''})` : ''}
                  {x.actionOverdueDays !== null && <strong> ■ {plural(x.actionOverdueDays, 'day')} overdue</strong>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function IssueSection({ r, raid }: { r: NonNullable<Raid['issues']>; raid: Raid }) {
  const prio = (['Critical', 'High', 'Medium', 'Low', 'Not set'] as const).filter((p) => (r.openByPriority[p] ?? 0) > 0).map((p) => `${r.openByPriority[p]} ${p.toLowerCase()}`).join(', ');
  return (
    <section aria-labelledby="is-h">
      <h3 id="is-h">Issues</h3>
      <p className="note">An issue is a problem that has already happened. Age = status date minus the day it was raised, in calendar days. A resolved issue shows the days from raised to resolved.</p>
      <p>
        {plural(r.open, 'open issue')}{prio ? ` (${prio})` : ''}; {r.resolved + r.closed} resolved or closed{r.statusUnknown > 0 ? `; ${r.statusUnknown} with no status` : ''}.
        {r.oldestOpen !== null ? ` Oldest open issue: ${plural(r.oldestOpen, 'day')}.` : raid.date ? '' : ' Choose a status date to see ages.'}
        {r.overdue > 0 ? ` ${r.overdue} past the due date.` : ''}
        {r.averageDaysToResolve !== null ? ` Resolved issues took ${f1(r.averageDaysToResolve)} days on average (${r.resolvedWithDates} with both dates).` : ''}
      </p>
      {(r.openNoDate > 0 || r.openNoOwner > 0) && <p className="note">Needs attention: {r.openNoDate} open without a raised date (no age), {r.openNoOwner} open with no owner.</p>}
      <div className="scroll" tabIndex={0}>
        <table>
          <caption>Issues, open ones first, oldest first</caption>
          <thead><tr><th scope="col">Issue</th><th scope="col">Priority</th><th scope="col">Owner</th><th scope="col">Status</th><th scope="col">Raised</th><th scope="col">Age or time to resolve</th></tr></thead>
          <tbody>
            {r.rows.map((x, i) => (
              <tr key={`${x.id}-${i}`} className={x.overdueDays !== null ? 'rag-red' : undefined}>
                <th scope="row">{x.id} {x.title}</th>
                <td>{x.priority ?? 'not set'}</td>
                <td>{x.owner || 'none'}</td>
                <td>{x.status === null ? 'not known' : x.status.charAt(0).toUpperCase() + x.status.slice(1)}</td>
                <td>{x.raised ?? 'not known'}</td>
                <td>
                  {x.days === null ? '-' : x.status === 'open' ? `${plural(x.days, 'day')} open` : `${plural(x.days, 'day')} to resolve`}
                  {x.overdueDays !== null && <strong> ■ {plural(x.overdueDays, 'day')} past due ({x.due})</strong>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const sign = (n: number | null, unit: string) => (n === null ? 'not stated' : `${n > 0 ? '+' : ''}${roundHalfUp(n, 1)} ${unit}`);

function ChangeSection({ r, raid }: { r: NonNullable<Raid['changes']>; raid: Raid }) {
  return (
    <section aria-labelledby="ch-h">
      <h3 id="ch-h">Changes</h3>
      <p className="note">Only approved changes are added up. A change that does not state its cost or schedule impact is counted as "not stated", never as 0. Scope growth = approved cost impact (hours) / original budget (hours), so it needs "Original budget (h)" on the Settings sheet.</p>
      <p>
        {plural(r.approved, 'approved change')} add {sign(r.approvedHours, 'h')} and {sign(r.approvedDays, 'days')}.
        {r.scopeGrowthPercent !== null ? ` Scope growth: ${f1(r.scopeGrowthPercent)}% of the original ${raid.budget} h.` : ' Scope growth is not shown: enter "Original budget (h)" on the Settings sheet.'}
        {' '}{r.requested} waiting for a decision{r.longestWaiting !== null ? ` (longest ${plural(r.longestWaiting, 'day')})` : ''}; {r.rejected} rejected, {r.withdrawn} withdrawn{r.decisionUnknown > 0 ? `, ${r.decisionUnknown} with no decision recorded` : ''}.
        {r.approvedMissingHours + r.approvedMissingDays > 0 ? ` Approved changes without a stated impact: ${r.approvedMissingHours} cost, ${r.approvedMissingDays} schedule.` : ''}
      </p>
      <div className="scroll" tabIndex={0}>
        <table>
          <caption>Changes: approved ones in decision order with running totals, then requests, then the rest</caption>
          <thead><tr><th scope="col">Change</th><th scope="col">Decision</th><th scope="col">Decided</th><th scope="col">Cost impact</th><th scope="col">Schedule impact</th><th scope="col">Running total (approved)</th></tr></thead>
          <tbody>
            {r.rows.map((x, i) => (
              <tr key={`${x.id}-${i}`}>
                <th scope="row">{x.id} {x.title}</th>
                <td>{x.decision === null ? 'not known' : x.decision.charAt(0).toUpperCase() + x.decision.slice(1)}{x.waitingDays !== null ? `, waiting ${plural(x.waitingDays, 'day')}` : ''}</td>
                <td>{x.decided ?? '-'}</td>
                <td>{sign(x.costHours, 'h')}</td>
                <td>{sign(x.scheduleDays, 'days')}</td>
                <td>{x.decision === 'approved' ? `${sign(x.runningHours, 'h')}, ${sign(x.runningDays, 'days')}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RaidScreen({ shared, onGoImport, onGoTemplate }: { shared: SharedData | null; onGoImport: () => void; onGoTemplate: () => void }) {
  const raid = useRaid(shared);

  function download() {
    if (!raid) return;
    const rows: CsvCell[][] = [['Section', 'ID', 'Item', 'Score or priority', 'Owner', 'Status or decision', 'Dates', 'Note']];
    raid.risks?.rows.forEach((x) => rows.push(['Risk', x.id, x.title, x.score === null ? 'not scored' : `${x.score} (${x.probability} x ${x.impact})`, x.owner, x.status ?? 'not known', x.actionDue ?? '', x.actionOverdueDays === null ? '' : `action ${x.actionOverdueDays} days overdue`]));
    raid.issues?.rows.forEach((x) => rows.push(['Issue', x.id, x.title, x.priority ?? 'not set', x.owner, x.status ?? 'not known', `${x.raised ?? ''} ${x.resolved ?? ''}`.trim(), x.days === null ? '' : `${x.days} days`]));
    raid.changes?.rows.forEach((x) => rows.push(['Change', x.id, x.title, `${x.costHours ?? 'not stated'} h; ${x.scheduleDays ?? 'not stated'} days`, x.requestedBy, x.decision ?? 'not known', `${x.requested ?? ''} ${x.decided ?? ''}`.trim(), x.decision === 'approved' ? `running ${x.runningHours ?? 'n/a'} h, ${x.runningDays ?? 'n/a'} days` : '']));
    saveCsv('openpm-lens-raid.csv', rows);
  }

  return (
    <section aria-labelledby="raid-h">
      <h2 id="raid-h">Risks, issues and changes</h2>
      <p className="lead">What could go wrong, what has gone wrong, and what has been added to the plan. Filled in on the Risks, Issues and Changes sheets of the template.</p>
      {!shared && <NeedsImport onGo={onGoImport} />}
      {shared && !raid && (
        <div className="card" role="note">
          <p>This tab reads the Risks, Issues and Changes sheets of the openpm-lens Excel template. The file loaded ({shared.fileName}) is not a template workbook, so there is nothing to show. A CSV file has no extra sheets.</p>
          <button type="button" onClick={onGoTemplate}>Get the template</button>
        </div>
      )}
      {raid && !raid.risks && !raid.issues && !raid.changes && (
        <div className="card" role="note"><p>The workbook has no Risks, Issues or Changes sheet. Add them (the current template has them) and upload again. Each sheet is optional.</p></div>
      )}
      {raid && raid.problems.length > 0 && <ul className="warn">{raid.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      {raid && !raid.date && <p className="note">No status date is set, so ages, waiting days and overdue items are not shown. Choose one on the Import tab or on the Settings sheet.</p>}
      {raid?.risks && <RiskSection r={raid.risks} raid={raid} />}
      {raid?.issues && <IssueSection r={raid.issues} raid={raid} />}
      {raid?.changes && <ChangeSection r={raid.changes} raid={raid} />}
      {raid && (raid.risks || raid.issues || raid.changes) && <p><button type="button" onClick={download}>Download risks, issues and changes (CSV)</button></p>}
    </section>
  );
}

/** A short summary for the Overview tab; nothing is shown when the file has none of the three sheets. */
export function RaidPanel({ shared, onGo }: { shared: SharedData | null; onGo: () => void }) {
  const raid = useRaid(shared);
  if (!raid || (!raid.risks && !raid.issues && !raid.changes)) return null;
  const { risks, issues, changes } = raid;
  return (
    <div className="panel">
      <h3>Risks, issues and changes</h3>
      <dl className="facts">
        {risks && <div><dt>Open risks</dt><dd>{risks.openCounts.high + risks.openCounts.medium + risks.openCounts.low + risks.openUnscored}<span className="sub"> ({risks.openCounts.high} high, {risks.openCounts.medium} medium, {risks.openCounts.low} low{risks.openUnscored > 0 ? `, ${risks.openUnscored} not scored` : ''})</span></dd></div>}
        {risks && <div><dt>Risk actions overdue</dt><dd>{raid.date ? risks.overdueActions : 'status date needed'}</dd></div>}
        {issues && <div><dt>Open issues</dt><dd>{issues.open}<span className="sub">{issues.oldestOpen !== null ? ` (oldest ${plural(issues.oldestOpen, 'day')})` : ''}</span></dd></div>}
        {issues && <div><dt>Issues past due</dt><dd>{raid.date ? issues.overdue : 'status date needed'}</dd></div>}
        {changes && <div><dt>Approved changes</dt><dd>{changes.approved}<span className="sub"> ({sign(changes.approvedHours, 'h')}, {sign(changes.approvedDays, 'days')})</span></dd></div>}
        {changes && <div><dt>Waiting for a decision</dt><dd>{changes.requested}</dd></div>}
      </dl>
      <p><button type="button" onClick={onGo}>Open risks, issues and changes</button></p>
    </div>
  );
}
