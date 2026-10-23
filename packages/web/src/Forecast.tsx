import { useEffect, useMemo, useState } from 'react';
import {
  FORECAST_DEFAULTS, chanceByDate, forecastMilestones, historyVerdict, roundHalfUp, simulateFinish, suggestFlowColumns, summarise, weeklyThroughput,
  type ForecastSummary, type MilestoneForecast, type WeeklyHistory,
} from '@openpm-lens/core';
import { ThroughputChart } from './charts';
import { ColumnSelect, NeedsImport, actualDatesOf } from './common';
import type { SharedData } from './shared';

const guessType = (headers: string[]) => headers.find((h) => /^(issue |work item |item )?type$/i.test(h.trim())) ?? null;

export interface ForecastResult {
  history: WeeklyHistory;
  verdict: ReturnType<typeof historyVerdict>;
  open: number;
  extra: number;
  summary: ForecastSummary | null;
  plannedFinish: string | null;
  chancePlanned: number | null;
  milestones: MilestoneForecast[];
  noDateOpen: number;
  doneNoDate: number;
}

/** Everything the Forecast tab and the Status report need, worked out the same way in both places. */
export function computeForecast(shared: SharedData, opts: { typeCol: string | null; doneCol: string | null; weeks: number; extra: number }): ForecastResult {
  const { headers, rows } = shared.table;
  const jT = opts.typeCol === null ? -1 : headers.indexOf(opts.typeCol);
  const a = actualDatesOf(headers, rows, shared.dateOrder, undefined, opts.doneCol);
  const excluded = (i: number) => jT >= 0 && /milestone/i.test(rows[i]?.[jT] ?? '');
  const finishes: string[] = [];
  let doneNoDate = 0, open = 0;
  shared.items.forEach((it, i) => {
    if (excluded(i) || it.statusCategory === 'cancelled') return;
    if (it.statusCategory === 'done') { const f = a.finish[i] ?? null; if (f === null) doneNoDate += 1; else finishes.push(f); } else open += 1;
  });
  const starts = a.start.filter((s): s is string => s !== null).sort();
  const history = weeklyThroughput(finishes, shared.statusDate, opts.weeks, starts[0] ?? null);
  const remaining = open + opts.extra;
  const dist = simulateFinish(history.weekly, remaining);
  const summary = dist ? summarise(dist, shared.statusDate) : null;
  const planned = shared.items.filter((it, i) => !excluded(i) && it.statusCategory !== 'cancelled' && it.baselineFinish !== null).map((it) => it.baselineFinish as string).sort();
  const plannedFinish = planned.length > 0 ? (planned[planned.length - 1] as string) : null;
  const gate = shared.items.map((it, i) => ({ id: it.id, name: it.name, plannedFinish: it.baselineFinish, done: it.statusCategory === 'done', cancelled: it.statusCategory === 'cancelled', excluded: excluded(i) }));
  const ms = shared.items.flatMap((it, i) => (jT >= 0 && /milestone/i.test(rows[i]?.[jT] ?? '') && it.statusCategory !== 'cancelled' && it.statusCategory !== 'done' ? [{ id: it.id, name: it.name, planned: it.baselineFinish }] : []));
  return {
    history, verdict: historyVerdict(history), open, extra: opts.extra, summary, plannedFinish,
    chancePlanned: dist && plannedFinish ? chanceByDate(dist, shared.statusDate, plannedFinish) : null,
    milestones: ms.length > 0 && history.finishedInWindow > 0 ? forecastMilestones(ms, gate, history.weekly, shared.statusDate) : [],
    noDateOpen: shared.items.filter((it, i) => !excluded(i) && it.statusCategory !== 'cancelled' && it.statusCategory !== 'done' && it.baselineFinish === null).length,
    doneNoDate,
  };
}

const pct = (x: number) => `${roundHalfUp(x * 100, 0)}%`;
export const VERDICT_TEXT: Record<ReturnType<typeof historyVerdict>, string> = {
  ok: '',
  none: 'No item finished in this window, so there is no pace to learn from and no forecast is given.',
  too_short: `Fewer than ${FORECAST_DEFAULTS.minWeeks} full weeks of history: too little to forecast from, so none is given.`,
  warn_short: `Fewer than ${FORECAST_DEFAULTS.warnBelowWeeks} weeks of history: the forecast will jump around. Treat it as rough.`,
  warn_long: `More than ${FORECAST_DEFAULTS.warnAboveWeeks} weeks of history: an old pace may no longer fit the team. Consider a shorter window.`,
};

export function ForecastScreen({ shared, onGoImport }: { shared: SharedData | null; onGoImport: () => void }) {
  const [typePick, setTypePick] = useState<string | null | undefined>(undefined);
  const [donePick, setDonePick] = useState<string | null | undefined>(undefined);
  const [weeks, setWeeks] = useState<number>(FORECAST_DEFAULTS.historyWeeks);
  const [extra, setExtra] = useState(0);
  useEffect(() => { setTypePick(undefined); setDonePick(undefined); }, [shared?.fileName, shared?.table]);
  const typeCol = typePick === undefined ? (shared ? guessType(shared.table.headers) : null) : typePick;
  const doneCol = donePick === undefined ? (shared ? suggestFlowColumns(shared.table.headers).done : null) : donePick;
  const r = useMemo(() => (shared && shared.statusDate ? computeForecast(shared, { typeCol, doneCol, weeks, extra }) : null), [shared, typeCol, doneCol, weeks, extra]);

  return (
    <>
      <h2>Finish-date forecast</h2>
      <p className="lead">When will the open work be finished? The answer is a range, not a date: it comes from how many items were finished each week in the past.</p>
      {!shared && <NeedsImport onGo={onGoImport} />}
      {shared && !shared.statusDate && <p className="warn">Set the status date on the Import tab first. Weeks are counted back from it.</p>}
      {shared && r && (
        <>
          <div className="form">
            <ColumnSelect label="Column with the ACTUAL finish date" headers={shared.table.headers} value={doneCol} onChange={setDonePick} />
            <ColumnSelect label="Column with the item type (milestones are left out of the counts)" headers={shared.table.headers} value={typeCol} onChange={setTypePick} />
            <label>Weeks of history to learn from
              <input type="number" min={1} max={104} value={weeks} onChange={(e) => setWeeks(Math.min(104, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} />
            </label>
            <label>Extra items still to come (new scope)
              <input type="number" min={0} max={10000} value={extra} onChange={(e) => setExtra(Math.min(10000, Math.max(0, Math.floor(Number(e.target.value)) || 0)))} />
            </label>
          </div>
          {doneCol === null && <p className="warn">No actual-finish column chosen, so there is no history to learn from.</p>}
          <p>
            <strong>{r.open}</strong> open item{r.open === 1 ? '' : 's'}{r.extra > 0 ? ` plus ${r.extra} extra` : ''}. History: <strong>{r.history.weekly.length}</strong> full week{r.history.weekly.length === 1 ? '' : 's'}
            {r.history.windowStart ? ` (${r.history.windowStart} to ${r.history.windowEnd})` : ''}, <strong>{r.history.finishedInWindow}</strong> item{r.history.finishedInWindow === 1 ? '' : 's'} finished in it.
          </p>
          {VERDICT_TEXT[r.verdict] && <p className="warn" role="note">{VERDICT_TEXT[r.verdict]}</p>}
          {r.history.weekly.length > 0 && (
            <ThroughputChart blocks={r.history.weekly.map((count, i) => {
              const end = new Date(Date.UTC(+shared.statusDate.slice(0, 4), +shared.statusDate.slice(5, 7) - 1, +shared.statusDate.slice(8, 10) - 7 * (r.history.weekly.length - 1 - i)));
              const to = end.toISOString().slice(0, 10);
              return { from: new Date(end.getTime() - 6 * 86_400_000).toISOString().slice(0, 10), to, count };
            })} />
          )}

          {r.summary && (r.verdict === 'ok' || r.verdict === 'warn_short' || r.verdict === 'warn_long') && (
            <section aria-labelledby="fc-h">
              <h3 id="fc-h">When the open work is done</h3>
              {r.open + r.extra === 0 ? <p>Nothing is left open, so there is nothing to forecast.</p> : (
                <div className="scroll" tabIndex={0}>
                  <table>
                    <caption>Finish date by confidence ({FORECAST_DEFAULTS.trials.toLocaleString('en-US')} simulated futures)</caption>
                    <thead><tr><th scope="col">Confidence</th><th scope="col">Finish by</th><th scope="col">Weeks from status date</th><th scope="col">How to read it</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">50%</th><td>{r.summary.date50 ?? 'not within 10 years'}</td><td>{r.summary.weeks50 ?? '-'}</td><td>A coin flip. Do not commit to it.</td></tr>
                      <tr><th scope="row">85%</th><td>{r.summary.date85 ?? 'not within 10 years'}</td><td>{r.summary.weeks85 ?? '-'}</td><td>The usual level to promise.</td></tr>
                      <tr><th scope="row">95%</th><td>{r.summary.date95 ?? 'not within 10 years'}</td><td>{r.summary.weeks95 ?? '-'}</td><td>For deadlines that are costly to miss.</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
              {r.plannedFinish && r.chancePlanned !== null && r.open + r.extra > 0 && (
                <p>Latest planned finish in the file is <strong>{r.plannedFinish}</strong>. At the recent pace, the chance of finishing all open items by then is about <strong>{pct(r.chancePlanned)}</strong>.</p>
              )}
              <p className="note">"85%" means 85 of 100 simulated futures finished by that date. A week's work is counted as done at the end of that week, so dates err on the late side.</p>
            </section>
          )}

          {r.milestones.length > 0 && (
            <section aria-labelledby="fm-h">
              <h3 id="fm-h">Milestone forecast</h3>
              <p className="note">Task dependencies are not read, so the work a milestone needs is taken to be the open items planned to finish on or before its planned date. This is an assumption, not a fact.</p>
              <div className="scroll" tabIndex={0}>
                <table>
                  <caption>Open milestones</caption>
                  <thead><tr><th scope="col">Milestone</th><th scope="col">Planned</th><th scope="col">Open items before it</th><th scope="col">85% finish by</th><th scope="col">Chance by planned date</th></tr></thead>
                  <tbody>
                    {r.milestones.map((m) => (
                      <tr key={m.id} className={m.chance !== null && m.chance < 0.5 ? 'rag-red' : undefined}>
                        <th scope="row">{m.id}{m.name !== m.id ? ` ${m.name}` : ''}</th>
                        <td>{m.planned ?? 'not known'}</td>
                        <td>{m.planned ? m.gating : '-'}</td>
                        <td>{m.summary?.date85 ?? '-'}</td>
                        <td>{m.chance === null ? '-' : pct(m.chance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section aria-labelledby="fa-h">
            <h3 id="fa-h">What this assumes</h3>
            <ul>
              <li>Items are about the same size, so counting items stands in for effort.</li>
              <li>The recent weekly pace is a fair guide to the coming weeks, and one week does not decide the next.</li>
              <li>The open work will not grow. If scope grows, add the extra items above, or the dates are too early.</li>
              <li>The simulation uses a fixed random seed ({FORECAST_DEFAULTS.seed}), so the same file always gives the same answer.</li>
            </ul>
            {(r.noDateOpen > 0 || r.doneNoDate > 0 || r.history.finishedBefore > 0 || r.history.finishedAfter > 0) && (
              <p className="note">
                Left out and not guessed:{r.doneNoDate > 0 ? ` ${r.doneNoDate} done without a finish date;` : ''}{r.history.finishedBefore > 0 ? ` ${r.history.finishedBefore} finished before the window;` : ''}
                {r.history.finishedAfter > 0 ? ` ${r.history.finishedAfter} finishes dated after the status date;` : ''}{r.noDateOpen > 0 ? ` ${r.noDateOpen} open without a planned finish (not in the milestone counts).` : ''}
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
