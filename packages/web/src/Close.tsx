import { useMemo } from 'react';
import { makeArchive, goRecordGaps, roundHalfUp, summariseBenefits, summariseChecklist, type BenefitState } from '@spashta/core';
import { NeedsImport } from './common';
import type { Lifecycle, SharedData } from './shared';
import { archiveSections } from './archiveSections';
import pkg from '../package.json';

function readSnapshots(): string | null {
  try { return localStorage.getItem('spashta-snapshots-v1') || localStorage.getItem('openpm-lens-snapshots-v1'); } catch { return null; }
}

function downloadArchive(s: SharedData | null, life: Lifecycle | null) {
  const when = new Date();
  const parts = life ?? s?.initiate ?? null;
  const bytes = makeArchive({
    fileName: s?.fileName ?? life?.fileName ?? '', statusDate: s?.statusDate || life?.settings.statusDate || null, exportedAt: when, version: pkg.version,
    tasks: s ? { headers: s.table.headers, rows: s.table.rows } : { headers: [], rows: [] },
    sections: archiveSections({ raid: life ?? s?.raid ?? null, initiate: parts, close: life ?? s?.close ?? null }), snapshotsJson: readSnapshots(),
  });
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url; a.download = `spashta-archive-${when.toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const STATE_TEXT: Record<BenefitState, string> = { not_measured: 'not measured yet', no_plan: 'no plan figure', behind: 'behind plan', on_plan: 'on plan', ahead: 'ahead of plan' };
const f1 = (x: number) => String(roundHalfUp(x, 1));
const num = (x: number | null) => (x === null ? '' : String(roundHalfUp(x, 2)));

export function CloseScreen({ shared, life, onGoImport, onGoTemplate }: { shared: SharedData | null; life: Lifecycle | null; onGoImport: () => void; onGoTemplate: () => void }) {
  const c = life ?? shared?.close ?? null;
  const ben = useMemo(() => (c?.benefits.present ? summariseBenefits(c.benefits.benefits) : null), [c]);
  const chk = useMemo(() => (c?.checklist.present ? summariseChecklist(c.checklist.items) : null), [c]);
  if (!shared && !(life && life.hasInitiateOrClose)) return (<><h2>Close and review</h2><NeedsImport onGo={onGoImport} what="This tab reads the Checklist, Benefits and Lessons sheets of the Spashta template workbook, and adds a summary of your tasks if you have loaded them." /></>);
  const none = !c || (!c.benefits.present && !c.checklist.present && !c.lessons.present);
  const items = (shared?.items ?? []).filter((i) => i.statusCategory !== 'cancelled');
  const statusDate = shared?.statusDate || life?.settings.statusDate || '';
  const doneCount = items.filter((i) => i.statusCategory === 'done').length;
  const sum = shared?.summary ?? null;
  const lessons = c?.lessons.present ? c.lessons.lessons : [];
  const go = (life ?? shared?.initiate)?.goRecord.record ?? null;
  const raid = life ?? shared?.raid ?? null;
  const risks = raid?.risks.present ? raid.risks.risks.filter((r) => r.status === 'open').length : null;
  const issues = raid?.issues.present ? raid.issues.issues.filter((i) => (i.status ?? 'open') === 'open').length : null;
  const byCat = new Map<string, typeof lessons>();
  for (const l of lessons) byCat.set(l.category, [...(byCat.get(l.category) ?? []), l]);

  return (
    <>
      <h2>Close and review</h2>
      <p className="lead noprint">Check that the closing steps are done, compare the benefits you promised with what was realised, keep the lessons, and print a one-page closure report.</p>
      {none && (
        <div className="card noprint" role="note">
          <p>The file you loaded has none of the Close sheets (Checklist, Benefits, Lessons). They are in the Spashta template workbook. The report below still shows what is in your task file.</p>
          <button type="button" onClick={onGoTemplate}>Go to the Template tab</button>
        </div>
      )}
      <p className="noprint"><button type="button" onClick={() => window.print()}>Print this page as the closure report</button></p>

      <section aria-labelledby="cl-sum">
        <h3 id="cl-sum">Closure report{(shared?.fileName ?? life?.fileName) ? `: ${shared?.fileName ?? life?.fileName}` : ''}</h3>
        {shared && sum ? (
          <>
            <p>Status date {statusDate || 'not set'}. {doneCount} of {items.length} items finished{items.length > 0 ? ` (${roundHalfUp((doneCount / items.length) * 100, 0)}%)` : ''}{shared.items.length - items.length > 0 ? `; ${shared.items.length - items.length} cancelled and left out` : ''}.</p>
            <div className="scroll" tabIndex={0}>
              <table>
                <caption>Effort summary (hours)</caption>
                <thead><tr><th scope="col">Measure</th><th scope="col">Hours</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Planned (budget at completion)</th><td>{sum.bac === null ? 'not available' : f1(sum.bac)}</td></tr>
                  <tr><th scope="row">Earned (work done, valued at plan)</th><td>{sum.ev === null ? 'not available' : f1(sum.ev)}</td></tr>
                  <tr><th scope="row">Actually spent</th><td>{sum.ac === null ? 'not available' : f1(sum.ac)}</td></tr>
                  <tr><th scope="row">Planned minus spent</th><td>{sum.bac === null || sum.ac === null ? 'not available' : f1(sum.bac - sum.ac)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="note">"Planned minus spent" only says how the project finished when all the work is done; before that, use the cost performance index on the Import and Overview tabs. Hours cover the {sum.costTasks} of {sum.tasksTotal} items that had the numbers needed.</p>
          </>
        ) : (
          <p className="note">No task file is loaded, so the effort summary is left out. The checklist, benefits and lessons below come from the workbook's own sheets.</p>
        )}
        <ul>
          {risks !== null && <li>{risks} risks still open.</li>}
          {issues !== null && <li>{issues} issues still open.</li>}
          {go?.decision && <li>Go / no-go decision: {go.decision === 'go' ? 'Go' : go.decision === 'no_go' ? 'No go' : 'Hold'}{go.date ? ` on ${go.date}` : ''}{goRecordGaps(go).length > 0 ? ` (record incomplete: ${goRecordGaps(go).join(', ')})` : ''}.</li>}
          {chk && <li>Closure checklist: {chk.done} of {chk.applicable} applicable items done.</li>}
          {ben && <li>Benefits: {ben.measured} of {ben.rows.length} measured{ben.mixedUnits ? '; they are in different units, so no overall total is given' : ''}{ben.bpi !== null ? `; realised ${num(ben.realised)} of ${num(ben.planned)} planned (${roundHalfUp(ben.bpi * 100, 0)}%) over the measured ones` : ''}.</li>}
          {c?.lessons.present && <li>{lessons.length} lessons recorded.</li>}
        </ul>
      </section>

      {chk && (
        <section aria-labelledby="cl-ck">
          <h3 id="cl-ck">Closure checklist</h3>
          {chk.groups.length === 0 ? <p>No items entered on the Checklist sheet.</p> : (
            <div className="scroll" tabIndex={0}>
              <table>
                <caption>Checklist progress by group</caption>
                <thead><tr><th scope="col">Group</th><th scope="col">Done</th><th scope="col">Open</th><th scope="col">No status</th><th scope="col">Not applicable</th></tr></thead>
                <tbody>{chk.groups.map((g) => <tr key={g.group}><th scope="row">{g.group}</th><td>{g.done} of {g.applicable}</td><td>{g.open}</td><td>{g.unknown}</td><td>{g.notApplicable}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {chk.open.length > 0 && (
            <>
              <h4>Still to do</h4>
              <ul>{chk.open.map((i) => <li key={`${i.group}-${i.item}`}>{i.item} ({i.group}{i.owner ? `, ${i.owner}` : ''}{i.status === null ? ', no status given' : ''})</li>)}</ul>
            </>
          )}
          <p className="note">An item with no status counts as not done. Not-applicable items are left out of the count.</p>
        </section>
      )}

      {ben && (
        <section aria-labelledby="cl-bn">
          <h3 id="cl-bn">Benefits: promised vs realised</h3>
          {ben.rows.length === 0 ? <p>No benefits entered on the Benefits sheet.</p> : (
            <div className="scroll" tabIndex={0}>
              <table>
                <caption>Benefits</caption>
                <thead><tr><th scope="col">Benefit</th><th scope="col">Owner</th><th scope="col">Measure</th><th scope="col">Planned</th><th scope="col">Realised</th><th scope="col">Realised ÷ planned</th><th scope="col">Difference</th><th scope="col">State</th></tr></thead>
                <tbody>
                  {ben.rows.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">{r.name}</th><td>{r.owner}</td><td>{r.measure}</td><td>{num(r.planned)}</td><td>{r.realised === null ? 'not yet' : num(r.realised)}</td>
                      <td>{r.bpi === null ? '' : `${roundHalfUp(r.bpi * 100, 0)}%`}</td><td>{num(r.variance)}</td><td>{STATE_TEXT[r.state]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {ben.mixedUnits && <p role="note" className="warn">These benefits are measured in different units (see the Measure column), so they are not added together. Each one is compared with its own plan.</p>}
          <p className="note">Realised ÷ planned is the benefit performance index; the difference is realised minus planned. The total adds the amounts first and then divides, and only counts benefits that have both a plan and a realised figure. Benefits not measured yet are left out, not counted as zero. Benefits are only added together when their Measure matches.</p>
        </section>
      )}

      {c?.lessons.present && (
        <section aria-labelledby="cl-ls">
          <h3 id="cl-ls">Lessons learned</h3>
          {lessons.length === 0 ? <p>No lessons entered on the Lessons sheet.</p> : [...byCat.entries()].map(([cat, ls]) => (
            <div key={cat}>
              <h4>{cat}</h4>
              <ul>{ls.map((l) => <li key={l.lesson}>{l.lesson}{l.recommendation ? ` Next time: ${l.recommendation}.` : ''}{l.owner ? ` (${l.owner})` : ''}</li>)}</ul>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="cl-ar" className="noprint">
        <h3 id="cl-ar">Archive everything</h3>
        <p>Download one zip file holding the task table, every filled sheet (risks, issues, changes, scoring, business case, stakeholders, RFI and RFP, go / no-go, checklist, lessons, benefits), the snapshots saved in this browser, and a README that lists what is inside. Open the CSV files in Excel.</p>
        <p><button type="button" onClick={() => downloadArchive(shared, life)}>Download archive (zip)</button></p>
        <p className="note">The archive is a copy of what you loaded, as read; no figures are recalculated. It is made on this device and not uploaded anywhere. Keep it with your project records.</p>
      </section>

      <section aria-labelledby="cl-so">
        <h3 id="cl-so">Sign-off</h3>
        <p>Sponsor: ______________________ Date: ____________</p>
        <p>Project manager: ______________________ Date: ____________</p>
      </section>
    </>
  );
}
