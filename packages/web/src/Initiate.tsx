import { useEffect, useMemo, useState } from 'react';
import {
  businessCase, goRecordGaps, gridQuadrant, QUADRANT_LABEL, roundHalfUp, scoreOptions, summariseSolicitations,
  type GridQuadrant,
} from '@spashta/core';
import { NeedsImport } from './common';
import type { SharedData } from './shared';

const readNum = (t: string | undefined): number | null => {
  const s = (t ?? '').trim();
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};
const money = (x: number | null, cur: string) => (x === null ? 'not available' : `${cur ? cur + ' ' : ''}${roundHalfUp(x, 2).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const yrs = (x: number | null) => (x === null ? 'not within the years listed' : `${roundHalfUp(x, 2)} years`);
const DECISION_LABEL = { go: 'Go', no_go: 'No go', hold: 'Hold' } as const;

export function InitiateScreen({ shared, onGoImport, onGoTemplate }: { shared: SharedData | null; onGoImport: () => void; onGoTemplate: () => void }) {
  const init = shared?.initiate ?? null;
  const settings = shared?.template?.settings ?? null;
  const [rate, setRate] = useState<string | undefined>(undefined);
  const [high, setHigh] = useState<string | undefined>(undefined);
  useEffect(() => { setRate(undefined); setHigh(undefined); }, [shared?.fileName, shared?.table]);
  const cur = settings?.currency ?? '';
  const rateText = rate ?? (settings?.discountRate === null || settings?.discountRate === undefined ? '' : String(settings.discountRate));
  const rateNum = readNum(rateText);
  const rateFraction = rateNum !== null && rateNum >= 0 && rateNum <= 100 ? rateNum / 100 : null;
  const highText = high ?? (settings?.highFrom === null || settings?.highFrom === undefined ? '' : String(settings.highFrom));
  const highNum = readNum(highText);
  const highFrom = highNum !== null && Number.isInteger(highNum) && highNum >= 2 && highNum <= 5 ? highNum : null;

  const scoring = useMemo(() => (init?.scoring.present ? scoreOptions(init.scoring.criteria, init.scoring.options) : null), [init]);
  const bc = useMemo(() => (init?.businessCase.present ? businessCase(init.businessCase.years, rateFraction) : null), [init, rateFraction]);
  const sol = useMemo(() => (init?.solicitations.present ? summariseSolicitations(init.solicitations.rows, shared?.statusDate || null) : null), [init, shared?.statusDate]);

  if (!shared) return (<><h2>Choose and justify</h2><NeedsImport onGo={onGoImport} /></>);
  const none = !init || (!init.scoring.present && !init.businessCase.present && !init.stakeholders.present && !init.solicitations.present && !init.goRecord.present);
  const go = init?.goRecord.record ?? null;
  const gaps = go ? goRecordGaps(go) : null;

  return (
    <>
      <h2>Choose and justify</h2>
      <p className="lead">The early questions: which option, is it worth the money, who matters, and did we decide. Every weight, score, rate and cut-off here is yours; the app only does the arithmetic and never fills one in.</p>
      {none && (
        <div className="card" role="note">
          <p>The file you loaded has none of the Initiate sheets (Scoring, Business case, Stakeholders, RFI-RFP, Go-no-go). They are in the Spashta template workbook.</p>
          <button type="button" onClick={onGoTemplate}>Go to the Template tab</button>
        </div>
      )}

      {scoring && (
        <section aria-labelledby="in-sc">
          <h3 id="in-sc">Compare options (weighted scoring)</h3>
          <p className="note">Score = sum of (weight × score) ÷ sum of weights, on the scale you scored with. Higher is better. An option with a missing score is not ranked.</p>
          {scoring.options.length === 0 || scoring.criteriaUsed === 0 ? (
            <p>Enter at least one weighted criterion and one option on the Scoring sheet.</p>
          ) : (
            <div className="scroll" tabIndex={0}>
              <table>
                <caption>Options ranked by weighted score</caption>
                <thead><tr><th scope="col">Rank</th><th scope="col">Option</th><th scope="col">Weighted score</th><th scope="col">Note</th></tr></thead>
                <tbody>
                  {[...scoring.options].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).map((o) => (
                    <tr key={o.option}>
                      <td>{o.rank ?? '-'}</td><th scope="row">{o.option}</th>
                      <td>{o.score === null ? 'not scored' : String(roundHalfUp(o.score, 2))}</td>
                      <td>{o.missing.length > 0 ? `Missing: ${o.missing.join(', ')}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="note">Weights total {scoring.weightTotal}. {scoring.ignored.length > 0 ? `Left out (no usable weight): ${scoring.ignored.join(', ')}. ` : ''}A high score is a guide for the discussion, not the decision.</p>
        </section>
      )}

      {init?.businessCase.present && (
        <section aria-labelledby="in-bc">
          <h3 id="in-bc">Business case</h3>
          <div className="form">
            <label>Discount rate (% a year, your figure)
              <input type="text" inputMode="decimal" value={rateText} onChange={(e) => setRate(e.target.value)} />
            </label>
          </div>
          {!bc ? <p>Add rows (Period, Cost, Benefit) on the Business case sheet.</p> : (
            <>
              <div className="scroll" tabIndex={0}>
                <table>
                  <caption>Business case results{cur ? ` (${cur})` : ''}</caption>
                  <thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">How it is worked out</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">Total cost</th><td>{money(bc.totalCost, cur)}</td><td>All costs, all periods</td></tr>
                    <tr><th scope="row">Total benefit</th><td>{money(bc.totalBenefit, cur)}</td><td>All benefits, all periods</td></tr>
                    <tr><th scope="row">ROI</th><td>{bc.roi === null ? 'not available' : `${roundHalfUp(bc.roi * 100, 1)}%`}</td><td>(benefit − cost) ÷ cost, not discounted</td></tr>
                    <tr><th scope="row">Payback</th><td>{yrs(bc.payback)}</td><td>When the running total of benefit minus cost reaches 0</td></tr>
                    <tr><th scope="row">NPV</th><td>{rateFraction === null ? 'enter a discount rate' : money(bc.npv, cur)}</td><td>Sum of (benefit − cost) ÷ (1 + rate)^period; period 0 is not discounted</td></tr>
                    <tr><th scope="row">Benefit-cost ratio</th><td>{bc.bcr === null ? (rateFraction === null ? 'enter a discount rate' : 'not available') : String(roundHalfUp(bc.bcr, 2))}</td><td>Discounted benefits ÷ discounted costs</td></tr>
                    <tr><th scope="row">Discounted payback</th><td>{rateFraction === null ? 'enter a discount rate' : yrs(bc.discountedPayback)}</td><td>Payback using discounted amounts</td></tr>
                    <tr><th scope="row">IRR</th><td>{bc.irr === null ? 'not available' : `${roundHalfUp(bc.irr * 100, 1)}%`}</td><td>The rate at which NPV would be 0</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="note">A positive NPV means the benefits are worth more than the costs after discounting. The result is only as good as the cost and benefit figures typed in, which are estimates. Money amounts are in one currency and one unit.</p>
            </>
          )}
        </section>
      )}

      {init?.stakeholders.present && (
        <section aria-labelledby="in-st">
          <h3 id="in-st">Stakeholder grid (power and interest)</h3>
          <div className="form">
            <label>"High" means a score of at least (2 to 5, your choice)
              <input type="text" inputMode="numeric" value={highText} onChange={(e) => setHigh(e.target.value)} />
            </label>
          </div>
          {highFrom === null ? <p>Enter the score from which you call power or interest "high" to place people on the grid.</p> : (
            <div className="grid">
              {(['manage_closely', 'keep_satisfied', 'keep_informed', 'monitor'] as GridQuadrant[]).map((q) => {
                const members = init.stakeholders.stakeholders.filter((s) => gridQuadrant(s.power, s.interest, highFrom) === q);
                return (
                  <article key={q} className="card" aria-labelledby={`q-${q}`}>
                    <h4 id={`q-${q}`}>{QUADRANT_LABEL[q]}</h4>
                    <p className="tags">{q === 'manage_closely' ? 'High power, high interest' : q === 'keep_satisfied' ? 'High power, low interest' : q === 'keep_informed' ? 'Low power, high interest' : 'Low power, low interest'}</p>
                    {members.length === 0 ? <p className="note">Nobody here.</p> : <ul>{members.map((m) => <li key={m.name}>{m.name}{m.role ? ` (${m.role})` : ''}</li>)}</ul>}
                  </article>
                );
              })}
            </div>
          )}
          {init.stakeholders.stakeholders.some((s) => s.power === null || s.interest === null) && (
            <p className="note">Not placed (power or interest missing): {init.stakeholders.stakeholders.filter((s) => s.power === null || s.interest === null).map((s) => s.name).join(', ')}.</p>
          )}
        </section>
      )}

      {sol && init && (
        <section aria-labelledby="in-so">
          <h3 id="in-so">RFI and RFP tracker</h3>
          <p>{sol.total} sent, {sol.received} answered, {sol.open} waiting{shared.statusDate ? `, ${sol.overdue} overdue at ${shared.statusDate}` : ' (set a status date to see overdue)'}{sol.noDue > 0 ? `; ${sol.noDue} waiting with no due date` : ''}.</p>
          {init.solicitations.rows.length > 0 && (
            <div className="scroll" tabIndex={0}>
              <table>
                <caption>Requests to vendors</caption>
                <thead><tr><th scope="col">ID</th><th scope="col">Type</th><th scope="col">Vendor</th><th scope="col">Due</th><th scope="col">Received</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {init.solicitations.rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td><td>{r.kind}</td><th scope="row">{r.vendor}</th><td>{r.due ?? ''}</td><td>{r.received ?? ''}</td>
                      <td>{r.status ?? ''}{!r.received && r.due && shared.statusDate && r.due < shared.statusDate ? ' (overdue)' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {init?.goRecord.present && (
        <section aria-labelledby="in-go">
          <h3 id="in-go">Go / no-go decision</h3>
          {!go || (go.decision === null && go.decidedBy === null && go.date === null && go.reason === null) ? <p>No decision recorded yet.</p> : (
            <p role="note">
              Decision: <strong>{go.decision ? DECISION_LABEL[go.decision] : 'not stated'}</strong>
              {go.decidedBy ? ` by ${go.decidedBy}` : ''}{go.date ? ` on ${go.date}` : ''}.{go.reason ? ` Reason: ${go.reason}` : ''}
            </p>
          )}
          {gaps && gaps.length > 0 && go && (go.decision !== null || go.decidedBy !== null || go.date !== null || go.reason !== null) && <p className="warn">Record is incomplete: still needs {gaps.join(', ')}.</p>}
          <p className="note">The app records and checks the decision; it does not make it.</p>
        </section>
      )}
    </>
  );
}
