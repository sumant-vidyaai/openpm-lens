import type { StepGroup } from '@openpm-lens/core';

const MAX_ROWS = 200;

export function ExplainPanel(props: {
  title: string;
  assumptions: string[];
  groups: StepGroup[];
  columns: string[];
  rows: { key: string; cells: string[]; used: boolean }[];
}) {
  const shown = props.rows.slice(0, MAX_ROWS);
  return (
    <details className="explain">
      <summary>{props.title}</summary>
      <h4>Assumptions in force</h4>
      <ul>{props.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      <h4>The formulas, with your numbers</h4>
      {props.groups.map((g) => (
        <div key={g.label}>
          <p><strong>{g.label}</strong></p>
          <ol>{g.steps.map((s) => <li key={s}><code>{s}</code></li>)}</ol>
        </div>
      ))}
      <h4>Task by task</h4>
      <div className="scroll">
        <table>
          <caption>Each task's contribution. Tasks left out say why.</caption>
          <thead><tr>{props.columns.map((c) => <th scope="col" key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key}>
                {r.cells.map((c, i) => (i === 0 ? <th scope="row" key={i}>{c}</th> : <td key={i}>{c}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.rows.length > MAX_ROWS && (
        <p className="note">Showing the first {MAX_ROWS} of {props.rows.length} tasks. The totals above include all of them.</p>
      )}
    </details>
  );
}

/** Formula walk-through without a per-task table (used for forecasts and earned schedule). */
export function StepsPanel(props: { title: string; assumptions: string[]; groups: StepGroup[] }) {
  return (
    <details className="explain">
      <summary>{props.title}</summary>
      <h4>Assumptions in force</h4>
      <ul>{props.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      <h4>The formulas, with your numbers</h4>
      {props.groups.map((g) => (
        <div key={g.label}>
          <p><strong>{g.label}</strong></p>
          <ol>{g.steps.map((s) => <li key={s}><code>{s}</code></li>)}</ol>
        </div>
      ))}
    </details>
  );
}
