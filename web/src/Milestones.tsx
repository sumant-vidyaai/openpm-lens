import { useEffect, useMemo, useState } from 'react';
import { analyseMilestones, MILESTONE_LABEL, parseDateText, roundHalfUp, type MilestoneState } from '@openpm-lens/core';
import { ColumnSelect } from './common';
import type { SharedData } from './shared';

const SYMBOL: Record<MilestoneState, string> = {
  done_on_time: '✓', done_late: '▲', done_no_date: '?', overdue: '■', due_soon: '●', upcoming: '○', no_planned_date: '?',
};
const guessType = (headers: string[]) => headers.find((h) => /^(issue |work item |item )?type$/i.test(h.trim())) ?? null;

/** Milestones on the Schedule tab: rows whose type contains "milestone", planned date against what happened. */
export function MilestoneSection({ shared, actualCol }: { shared: SharedData; actualCol: string | null }) {
  const [pick, setPick] = useState<string | null | undefined>(undefined);
  useEffect(() => setPick(undefined), [shared.fileName, shared.table]);
  const typeCol = pick === undefined ? guessType(shared.table.headers) : pick;

  const result = useMemo(() => {
    if (typeCol === null) return null;
    const jT = shared.table.headers.indexOf(typeCol);
    const jA = actualCol === null ? -1 : shared.table.headers.indexOf(actualCol);
    const list = shared.items.flatMap((it, i) => {
      const type = (shared.table.rows[i]?.[jT] ?? '').trim();
      if (!/milestone/i.test(type)) return [];
      const text = jA < 0 ? '' : (shared.table.rows[i]?.[jA] ?? '').trim();
      return [{
        id: it.id, name: it.name, planned: it.baselineFinish,
        actual: text === '' ? null : parseDateText(text, shared.dateOrder, 'actualFinish').iso,
        done: it.statusCategory === 'done', cancelled: it.statusCategory === 'cancelled',
      }];
    });
    return analyseMilestones(list, shared.statusDate);
  }, [shared, typeCol, actualCol]);

  return (
    <section aria-labelledby="ms-h">
      <h3 id="ms-h">Milestones</h3>
      <p className="note">Rows whose type contains the word "milestone". Each is compared with its planned finish date. Days are calendar days. Nothing is forecast here: a milestone's own forecast needs task dependencies, which are not read yet.</p>
      <div className="form">
        <ColumnSelect label="Column with the item type" headers={shared.table.headers} value={typeCol} onChange={setPick} />
      </div>
      {result === null && <p className="note">Choose the type column to list milestones.</p>}
      {result !== null && result.rows.length === 0 && <p className="note">No row has the type "milestone"{result.cancelled > 0 ? ` (${result.cancelled} cancelled left out)` : ''}.</p>}
      {result !== null && result.rows.length > 0 && (
        <>
          <p>
            {result.counts.overdue} overdue, {result.counts.due_soon} due within 14 days, {result.counts.done_on_time + result.counts.done_late} finished
            ({result.counts.done_late} late){result.averageSlip === null ? '' : `; finished milestones were on average ${roundHalfUp(result.averageSlip, 1)} days ${result.averageSlip > 0 ? 'late' : 'early or on time'}`}.
          </p>
          <div className="scroll" tabIndex={0}>
            <table>
              <caption>Milestones, earliest planned date first</caption>
              <thead><tr><th scope="col">Milestone</th><th scope="col">Planned</th><th scope="col">Actual</th><th scope="col">State</th></tr></thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} className={r.state === 'overdue' || r.state === 'done_late' ? 'rag-red' : undefined}>
                    <th scope="row">{r.id}{r.name !== r.id ? ` ${r.name}` : ''}</th>
                    <td>{r.planned ?? 'not known'}</td>
                    <td>{r.actual ?? '-'}</td>
                    <td>
                      <span aria-hidden="true">{SYMBOL[r.state]} </span>{MILESTONE_LABEL[r.state]}
                      {r.days !== null && (r.state === 'overdue' ? `, ${r.days} day${r.days === 1 ? '' : 's'} past due`
                        : r.state === 'done_late' ? `, ${r.days} day${r.days === 1 ? '' : 's'} late`
                        : r.state === 'due_soon' || r.state === 'upcoming' ? `, in ${r.days} day${r.days === 1 ? '' : 's'}` : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(result.counts.no_planned_date > 0 || result.counts.done_no_date > 0) && (
            <p className="note">{result.counts.no_planned_date} without a planned date and {result.counts.done_no_date} done without a finish date are listed with "?" and not guessed.{result.cancelled > 0 ? ` ${result.cancelled} cancelled left out.` : ''}</p>
          )}
        </>
      )}
    </section>
  );
}
