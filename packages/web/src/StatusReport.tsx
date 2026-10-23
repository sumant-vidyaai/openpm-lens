import { useMemo, useState } from 'react';
import { DEFAULT_THRESHOLDS, HEALTH_LABEL, analyseMilestones, assessHealth, parseDateText, suggestFlowColumns, writeCommentary, type ReportFacts } from '@openpm-lens/core';
import { NeedsImport } from './common';
import { VERDICT_TEXT, computeForecast } from './Forecast';
import { computeRaid } from './Raid';
import type { SharedData } from './shared';

const MY_BOXES = ['Highlights to add', 'Concerns to add', 'Decisions needed', 'Next steps'] as const;

function buildFacts(shared: SharedData): ReportFacts {
  const sm = shared.summary, ts = shared.template?.settings;
  const th = ts != null && ts.greenMin !== null && ts.amberMin !== null ? { ...DEFAULT_THRESHOLDS, greenMin: ts.greenMin as number, amberMin: ts.amberMin as number } : DEFAULT_THRESHOLDS;
  const h = assessHealth({ ev: sm.ev, ac: sm.ac, costTasks: sm.costTasks, evSchedule: sm.evSchedule, pv: sm.pv, scheduleTasks: sm.scheduleTasks }, th);
  const { headers, rows } = shared.table;
  const typeCol = headers.find((x) => /^(issue |work item |item )?type$/i.test(x.trim())) ?? null;
  const jT = typeCol === null ? -1 : headers.indexOf(typeCol);
  const doneCol = suggestFlowColumns(headers).done;
  const jA = doneCol === null ? -1 : headers.indexOf(doneCol);
  const cat = (c: string) => shared.items.filter((i) => i.statusCategory === c).length;
  const defCol = jT;
  const openDefects = defCol < 0 ? null : shared.items.filter((it, i) => /bug|defect|incident|problem/i.test(rows[i]?.[defCol] ?? '') && it.statusCategory !== 'done' && it.statusCategory !== 'cancelled').length;
  let milestones: ReportFacts['milestones'] = null;
  if (jT >= 0 && shared.statusDate) {
    const list = shared.items.flatMap((it, i) => {
      if (!/milestone/i.test(rows[i]?.[jT] ?? '')) return [];
      const t = jA < 0 ? '' : (rows[i]?.[jA] ?? '').trim();
      return [{ id: it.id, name: it.name, planned: it.baselineFinish, actual: t === '' ? null : parseDateText(t, shared.dateOrder, 'actualFinish').iso, done: it.statusCategory === 'done', cancelled: it.statusCategory === 'cancelled' }];
    });
    const m = analyseMilestones(list, shared.statusDate);
    milestones = { overdue: m.counts.overdue, dueSoon: m.counts.due_soon, open: m.counts.overdue + m.counts.due_soon + m.counts.upcoming };
  }
  let forecast: ReportFacts['forecast'] = null;
  if (shared.statusDate) {
    const f = computeForecast(shared, { typeCol, doneCol, weeks: 12, extra: 0 });
    if (f.open > 0) {
      const ok = f.summary !== null && (f.verdict === 'ok' || f.verdict === 'warn_short' || f.verdict === 'warn_long');
      forecast = { open: f.open, date50: ok ? f.summary!.date50 : null, date85: ok ? f.summary!.date85 : null, date95: ok ? f.summary!.date95 : null, plannedFinish: f.plannedFinish, chancePlanned: ok ? f.chancePlanned : null, verdictNote: VERDICT_TEXT[f.verdict] };
    }
  }
  const r = computeRaid(shared);
  const raid: ReportFacts['raid'] = r === null ? null : {
    highRisks: r.risks?.openCounts.high ?? 0,
    openRisks: r.risks ? r.risks.openCounts.high + r.risks.openCounts.medium + r.risks.openCounts.low + r.risks.openUnscored : 0,
    overdueActions: r.risks?.overdueActions ?? 0,
    openIssues: r.issues?.open ?? 0, overdueIssues: r.issues?.overdue ?? 0, oldestIssueDays: r.issues?.oldestOpen ?? null,
    approvedHours: r.changes?.approvedHours ?? 0, approvedDays: r.changes?.approvedDays ?? 0, scopeGrowthPercent: r.changes?.scopeGrowthPercent ?? null,
    waitingRequests: r.changes?.requested ?? 0,
  };
  return {
    statusDate: shared.statusDate, health: h.health, cpi: h.cpi, spi: h.spi,
    counts: { total: shared.items.length, done: cat('done'), inProgress: cat('in_progress'), notStarted: cat('not_started'), cancelled: cat('cancelled') },
    openDefects, milestones, forecast, raid, drags: [],
  };
}

export function StatusReportScreen({ shared, onGoImport }: { shared: SharedData | null; onGoImport: () => void }) {
  const [title, setTitle] = useState('');
  const [boxes, setBoxes] = useState<string[]>(['', '', '', '']);
  const c = useMemo(() => (shared && shared.statusDate ? writeCommentary(buildFacts(shared)) : null), [shared]);
  const filled = boxes.some((b) => b.trim() !== '');
  function print() {
    const old = document.title;
    document.title = `openpm-lens status report - ${shared?.statusDate ?? ''}`.trim();
    const restore = () => { document.title = old; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  }
  return (
    <section aria-labelledby="sr-h">
      <h2 id="sr-h">Status report</h2>
      <p className="lead noprint">A one-page report you can print or save as PDF. The sentences are written from your numbers and say what they show, not why. Add the reasons and decisions in the boxes below.</p>
      {!shared && <NeedsImport onGo={onGoImport} />}
      {shared && !shared.statusDate && <p className="warn">Set the status date on the Import tab first.</p>}
      {shared && c && (
        <>
          <div className="form noprint">
            <label>Report title (optional)<input type="text" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
            {MY_BOXES.map((label, i) => (
              <label key={label}>{label}
                <textarea rows={3} maxLength={1500} value={boxes[i]} onChange={(e) => setBoxes((cur) => cur.map((b, j) => (j === i ? e.target.value : b)))} />
              </label>
            ))}
            <div className="snap-actions"><button type="button" onClick={print}>Download report (PDF)</button></div>
            <p className="note">The button opens your browser's print window: choose "Save as PDF" as the printer. What you type here stays on this page and is not saved or sent anywhere.</p>
          </div>

          <article className="report" aria-label="Status report preview">
            <h3>{title.trim() !== '' ? title.trim() : shared.fileName}</h3>
            <p><strong>{c.headline}</strong></p>
            {c.highlights.length > 0 && (<><h4>What is going well, or neutral</h4><ul>{c.highlights.map((s) => <li key={s}>{s}</li>)}</ul></>)}
            {c.concerns.length > 0 && (<><h4>What needs attention</h4><ul>{c.concerns.map((s) => <li key={s}>{s}</li>)}</ul></>)}
            {MY_BOXES.map((label, i) => (boxes[i] ?? '').trim() !== '' && (
              <div key={label}><h4>{label.replace(' to add', '')}</h4><p className="pre">{(boxes[i] ?? '').trim()}</p></div>
            ))}
            <h4>Limits of this report</h4>
            <ul>{c.limits.map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="note">Health rating: {HEALTH_LABEL[buildFacts(shared).health]}. Made with openpm-lens from {shared.fileName}, status date {shared.statusDate}.{filled ? '' : ' Add your own notes above to complete it.'}</p>
          </article>
        </>
      )}
    </section>
  );
}
