import { useMemo, useState } from 'react';
import { caseStudy, practiceQuestions, type PracticeQuestion } from '@spashta/core';

function QuestionView({ x, picked, checked, onPick, onCheck }: { x: PracticeQuestion; picked: number | undefined; checked: boolean; onPick: (i: number) => void; onCheck: () => void }) {
  const right = checked && picked === x.answer;
  return (
    <fieldset className="card practice-q">
      <legend>{x.prompt} <span className="tags">{x.topic}</span></legend>
      {x.choices.map((c, i) => (
        <label key={c} className="practice-choice">
          <input type="radio" name={`pq-${x.id}`} checked={picked === i} disabled={checked} onChange={() => onPick(i)} /> {c}
        </label>
      ))}
      {!checked && <p><button type="button" disabled={picked === undefined} onClick={onCheck}>Check my answer</button></p>}
      {checked && (
        <p role="status" className={right ? undefined : 'warn'}>
          <strong>{right ? 'Correct.' : `Not quite. The answer is: ${x.choices[x.answer]}.`}</strong> {x.explain}
        </p>
      )}
    </fieldset>
  );
}

export function PracticeSection() {
  const questions = useMemo(() => practiceQuestions(), []);
  const study = useMemo(() => caseStudy(), []);
  const all = useMemo(() => [...questions, ...study.steps], [questions, study]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const done = all.filter((x) => checked[x.id]).length;
  const correct = all.filter((x) => checked[x.id] && picked[x.id] === x.answer).length;
  const view = (x: PracticeQuestion) => (
    <QuestionView key={x.id} x={x} picked={picked[x.id]} checked={checked[x.id] === true}
      onPick={(i) => setPicked((p) => ({ ...p, [x.id]: i }))} onCheck={() => setChecked((c) => ({ ...c, [x.id]: true }))} />
  );
  return (
    <section aria-labelledby="practice-h">
      <h3 id="practice-h">Practice</h3>
      <p>Try the numbers yourself. Each answer is worked out by the same code the app uses, and the explanation shows the working. Nothing is saved or sent anywhere.</p>
      <p role="status"><strong>{done === 0 ? 'No questions answered yet.' : `${correct} correct out of ${done} answered (${all.length} questions in all).`}</strong>{' '}
        {done > 0 && <button type="button" onClick={() => { setPicked({}); setChecked({}); }}>Start again</button>}</p>
      <h4>Quick questions</h4>
      {questions.map(view)}
      <h4>{study.title}</h4>
      <p>{study.story}</p>
      {study.steps.map(view)}
    </section>
  );
}
