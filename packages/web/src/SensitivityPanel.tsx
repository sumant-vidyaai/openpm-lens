import { useMemo } from 'react';
import { roundHalfUp, weightSensitivity, type Criterion, type FlipPoint, type OptionScores } from '@spashta/core';

const r = (n: number) => String(roundHalfUp(n, 2));
const flip = (f: FlipPoint | null, dir: 'lower' | 'higher') => {
  if (f === null) return dir === 'lower' ? 'No lower weight changes the top choice' : 'No higher weight changes the top choice';
  return `${dir === 'lower' ? 'Down' : 'Up'} to ${r(f.weight)} (${f.percent > 0 ? '+' : ''}${r(f.percent)}%): ${f.challenger} draws level, and leads beyond that`;
};

/** "How firm is the top choice?": for each weight, how far it can move (alone) before another option takes the lead. Exact, from the same scoring rule. */
export function SensitivityPanel({ criteria, options }: { criteria: readonly Criterion[]; options: readonly OptionScores[] }) {
  const s = useMemo(() => weightSensitivity(criteria, options), [criteria, options]);
  if (s.leader === null) {
    return (
      <details className="explain">
        <summary>How firm is the top choice? (weights check)</summary>
        <p className="note">{s.tiedAtTop.length > 1 ? `${s.tiedAtTop.join(' and ')} are tied at the top, so there is no single leader to test.` : 'This needs at least two options with a full set of scores.'}</p>
      </details>
    );
  }
  const closest = s.rows.flatMap((x) => [x.lower, x.higher].map((f, i) => (f ? { crit: x.criterion, f, dir: i === 0 ? 'lower' : 'higher' } : null))).filter((x): x is { crit: string; f: FlipPoint; dir: string } => x !== null)
    .sort((a, b) => Math.abs(a.f.percent) - Math.abs(b.f.percent))[0];
  return (
    <details className="explain" open>
      <summary>How firm is the top choice? (weights check)</summary>
      {s.holdsForAnyWeight ? (
        <p><strong>{s.leader}</strong> stays on top whatever any single weight is. It scores at least as well as every other option on every criterion that separates them.</p>
      ) : (
        <p><strong>{s.leader}</strong> leads now. The closest call: if the weight of <strong>{closest?.crit}</strong> moved {closest && closest.f.percent > 0 ? 'up' : 'down'} by {closest ? r(Math.abs(closest.f.percent)) : ''}%, {closest?.f.challenger} would draw level.</p>
      )}
      <div className="scroll" tabIndex={0}>
        <table>
          <caption>One weight at a time, the others unchanged</caption>
          <thead><tr><th>Criterion</th><th>Weight now</th><th>Lower</th><th>Higher</th></tr></thead>
          <tbody>
            {s.rows.map((x) => <tr key={x.criterion}><th scope="row">{x.criterion}</th><td>{r(x.weight)}</td><td>{flip(x.lower, 'lower')}</td><td>{flip(x.higher, 'higher')}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="note">Worked out exactly, not by trial: for the leader and each other option, the weight where their scores are equal. A weight can go down to 0 (leaving the criterion out). A small percentage means a close call; the weights are yours, so judge whether a move that size is plausible. {s.leftOut.length > 0 ? `Left out (missing scores): ${s.leftOut.join(', ')}.` : ''}</p>
    </details>
  );
}
