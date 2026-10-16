import { costContributors, fixFirst, roundHalfUp, scheduleContributors, type Contributors } from '@openpm-lens/core';
import type { SharedData } from './shared';

const h1 = (n: number) => `${roundHalfUp(n, 1)} h`;

function Table({ caption, c, names, what }: { caption: string; c: Contributors; names: string[]; what: string }) {
  if (c.negativeTasks === 0) return <p className="note">{caption}: no task is below its {what}.</p>;
  return (
    <div className="scroll" tabIndex={0}>
      <table>
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Task</th><th scope="col">Variance</th><th scope="col">Share of the shortfall</th></tr></thead>
        <tbody>
          {c.items.map((x) => (
            <tr key={x.index}>
              <th scope="row">{x.id}{names[x.index] && names[x.index] !== x.id ? ` ${names[x.index]}` : ''}</th>
              <td>{h1(x.variance)}</td>
              <td>{roundHalfUp(x.share * 100, 0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">
        {c.negativeTasks} task{c.negativeTasks === 1 ? '' : 's'} are behind, adding up to {h1(c.shortfall)}; the others are ahead by {h1(c.surplus)}, so the net is {h1(c.net)}.
        {c.notShown > 0 ? ` ${c.notShown} more are not listed.` : ''}
      </p>
    </div>
  );
}

/** Which tasks pull cost and schedule down the most. */
export function WhyPanel({ shared }: { shared: SharedData }) {
  const names = shared.items.map((i) => i.name);
  const cost = costContributors(shared.evmRows);
  const sched = shared.statusDate ? scheduleContributors(shared.schedRows) : null;
  return (
    <section aria-labelledby="why-h">
      <h3 id="why-h">What is pulling it down?</h3>
      <p className="note">Variance = earned value minus actual hours (cost), or minus planned value (schedule). Negative means over budget or behind plan. Shown in hours so the lists add up to the headline numbers.</p>
      <div className="rulers">
        <div className="panel"><h4>Cost: biggest overruns</h4><Table caption="Cost variance by task (hours)" c={cost} names={names} what="actual hours" /></div>
        <div className="panel"><h4>Schedule: furthest behind</h4>
          {sched ? <Table caption="Schedule variance by task (hours)" c={sched} names={names} what="plan" /> : <p className="note">Choose a status date on the Import tab to see schedule.</p>}
        </div>
      </div>
    </section>
  );
}

/** Tasks left out of the numbers, grouped by what is missing. */
export function FixPanel({ shared }: { shared: SharedData }) {
  const cancelled = shared.items.map((i) => i.statusCategory === 'cancelled');
  const { groups, cancelledCount } = fixFirst(shared.evmRows, shared.statusDate ? shared.schedRows : [], cancelled);
  if (groups.length === 0 && cancelledCount === 0) return null;
  return (
    <section aria-labelledby="fix-h">
      <h3 id="fix-h">Fix these first</h3>
      {groups.length === 0 ? <p className="note">Every task that is in scope is used in the numbers.</p> : (
        <>
          <p className="note">Tasks left out of a measure, biggest group first. Fixing the biggest group lifts the most tasks into the numbers.</p>
          <ol className="plain">
            {groups.map((g) => (
              <li key={`${g.area}-${g.reason}`}>
                <strong>{g.count} task{g.count === 1 ? '' : 's'}</strong> left out of {g.area.toLowerCase()}: {g.reason}. For example {g.ids.join(', ')}{g.count > g.ids.length ? ' and more' : ''}.
              </li>
            ))}
          </ol>
        </>
      )}
      {cancelledCount > 0 && <p className="note">{cancelledCount} cancelled task{cancelledCount === 1 ? ' is' : 's are'} left out on purpose.</p>}
    </section>
  );
}
