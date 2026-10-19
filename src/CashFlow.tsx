import { useEffect, useMemo, useState } from 'react';
import { actualSpendItems, monthly, roundHalfUp, spreadDaily, suggestFlowColumns, type MoneyResult } from '@openpm-lens/core';
import { CashFlowChart } from './charts';
import { ColumnSelect, actualDatesOf, suggestActualStart } from './common';
import type { SharedData } from './shared';

/** Monthly cash flow: planned money (budget spread over each task's planned dates) against actual money (spread from actual start). */
export function CashFlow({ shared, money, cur }: { shared: SharedData; money: MoneyResult; cur: string }) {
  const [startPick, setStartPick] = useState<string | null | undefined>(undefined);
  const [finishPick, setFinishPick] = useState<string | null | undefined>(undefined);
  useEffect(() => { setStartPick(undefined); setFinishPick(undefined); }, [shared.fileName, shared.table]);
  const startCol = startPick === undefined ? suggestActualStart(shared.table.headers) : startPick;
  const finishCol = finishPick === undefined ? suggestFlowColumns(shared.table.headers).done : finishPick;

  const view = useMemo(() => {
    if (!shared.statusDate) return null;
    const rule = { mode: shared.dayCount, holidays: shared.holidays };
    const plannedItems = money.rows.map((r, i) => ({ id: r.id, amount: r.bac, start: shared.items[i]?.baselineStart ?? null, end: shared.items[i]?.baselineFinish ?? null }));
    const planned = spreadDaily(plannedItems, rule);
    const a = actualDatesOf(shared.table.headers, shared.table.rows, shared.dateOrder, startCol, finishCol);
    const spend = actualSpendItems(money.rows.map((r, i) => ({ id: r.id, amount: r.ac, start: a.start[i] ?? null, finish: a.finish[i] ?? null })), shared.statusDate);
    const actual = startCol === null ? null : spreadDaily(spend.items, rule);
    const rows = monthly(planned.days, actual?.days ?? new Map());
    const statusMonth = shared.statusDate.slice(0, 7);
    return { planned, actual, spendLeft: spend.left, rows, statusMonth };
  }, [shared, money, startCol, finishCol]);

  const fmt = (n: number) => `${cur ? cur + ' ' : ''}${roundHalfUp(n, 0).toLocaleString('en-US')}`;
  const chartRows = view ? view.rows.map((r) => ({ month: r.month, plannedCum: r.plannedCum, actualCum: view.actual && r.month <= view.statusMonth ? r.actualCum : null })) : [];
  return (
    <section aria-labelledby="cf-h">
      <h3 id="cf-h">Cash flow by month</h3>
      <p className="note">Planned: each task's budget (planned hours x rate) spread evenly over its planned working days. Actual: each task's actual cost spread evenly from its actual start to its actual finish, or to the status date if not finished. Spreading evenly is an assumption of this app: task lists do not record spending day by day.</p>
      {!shared.statusDate && <p className="warn">Choose a status date on the Import tab to see cash flow. It is not assumed.</p>}
      <div className="form">
        <ColumnSelect label="Column with the ACTUAL start date" headers={shared.table.headers} value={startCol} onChange={setStartPick} />
        <ColumnSelect label="Column with the ACTUAL finish date" headers={shared.table.headers} value={finishCol} onChange={setFinishPick} />
      </div>
      {view && startCol === null && <p className="warn">No actual start column chosen, so actual spending cannot be placed in time. Planned cash flow is shown below.</p>}
      {view && view.rows.length > 0 && (
        <>
          <CashFlowChart rows={chartRows} unit={cur} statusDate={shared.statusDate} />
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Cash flow by month ({cur || 'hours'})</caption>
              <thead><tr><th scope="col">Month</th><th scope="col">Planned</th><th scope="col">Actual</th><th scope="col">Planned, cumulative</th><th scope="col">Actual, cumulative</th></tr></thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.month}>
                    <th scope="row">{r.month}</th>
                    <td>{fmt(r.planned)}</td>
                    <td>{view.actual && r.month <= view.statusMonth ? fmt(r.actual) : '-'}</td>
                    <td>{fmt(r.plannedCum)}</td>
                    <td>{view.actual && r.month <= view.statusMonth ? fmt(r.actualCum) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            Planned covers {fmt(view.planned.spread)} of {fmt(view.planned.total)} budget{view.planned.left.length > 0 ? ` (${view.planned.left.length} priced task${view.planned.left.length === 1 ? ' has' : 's have'} no usable planned dates)` : ''}.
            {view.actual ? ` Actual covers ${fmt(view.actual.spread)} of ${fmt(money.ac ?? 0)} actual cost${view.spendLeft.length + view.actual.left.length > 0 ? ` (${view.spendLeft.length + view.actual.left.length} task${view.spendLeft.length + view.actual.left.length === 1 ? ' has' : 's have'} no usable actual start date)` : ''}.` : ''}
          </p>
        </>
      )}
    </section>
  );
}
