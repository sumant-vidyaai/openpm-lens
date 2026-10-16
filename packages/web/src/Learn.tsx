import { useMemo, useState } from 'react';
import { CAUTIONS, QUESTIONS, TERMS } from './learnContent';

export function LearnScreen() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');
  const groups = useMemo(() => ['All', ...[...new Set(TERMS.map((t) => t.group))]], []);
  const shown = TERMS.filter((t) => (group === 'All' || t.group === group)
    && (q.trim() === '' || `${t.term} ${t.means} ${t.formula ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <section aria-labelledby="learn-h">
      <h2 id="learn-h">Learn</h2>
      <p className="lead">Plain-language help for the numbers in this app. Start with "Which question, which metric?", then look up any word in the glossary.</p>

      <h3>Which question, which metric?</h3>
      <div className="scroll">
        <table>
          <caption>Questions a project manager asks, and where to find the answer</caption>
          <thead><tr><th scope="col">Question</th><th scope="col">Look at</th><th scope="col">Tab</th><th scope="col">What your file needs</th></tr></thead>
          <tbody>{QUESTIONS.map((x) => <tr key={x.question}><th scope="row">{x.question}</th><td>{x.answer}</td><td>{x.tab}</td><td>{x.needs}</td></tr>)}</tbody>
        </table>
      </div>

      <h3>Reading the numbers safely</h3>
      <ul>{CAUTIONS.map((c) => <li key={c}>{c}</li>)}</ul>

      <h3>Glossary ({shown.length} of {TERMS.length})</h3>
      <div className="form">
        <label>Search <input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label>Topic{' '}
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
      </div>
      {shown.length === 0 && <p>No term matches. Try a shorter word.</p>}
      <dl className="glossary">
        {shown.map((t) => (
          <div key={t.term} className="card">
            <dt><strong>{t.term}</strong> <span className="tags">{t.group}</span></dt>
            <dd>
              <p>{t.means}</p>
              {t.formula && <p><strong>Formula:</strong> <code>{t.formula}</code></p>}
              {t.where && <p className="note">Find it in: {t.where}</p>}
              {t.caution && <p className="note">Good to know: {t.caution}</p>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
