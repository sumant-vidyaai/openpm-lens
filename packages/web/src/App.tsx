import { useState } from 'react';
import { metricFunctions, roundHalfUp } from '@openpm-lens/core';
import { cards } from './cards';

type Theme = 'system' | 'light' | 'dark';

function applyTheme(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === 'system') localStorage.removeItem('openpm-lens-theme');
    else localStorage.setItem('openpm-lens-theme', theme);
  } catch {
    /* ignore */
  }
}

function MetricCardView({ id }: { id: string }) {
  const card = cards.find((c) => c.id === id);
  if (!card) return null;
  const fn = metricFunctions[card.id];
  const value = fn ? fn(card.worked_example.inputs) : null;
  return (
    <article className="card" aria-labelledby={`h-${card.id}`}>
      <h3 id={`h-${card.id}`}>{card.name}</h3>
      <p className="tags">
        {card.domain} · {card.area}
      </p>
      <p>{card.meaning}</p>
      <p>
        <strong>Formula:</strong> <code>{card.formula}</code>
      </p>
      <p>
        <strong>Needs:</strong> {card.required.join(', ')}
      </p>
      <details>
        <summary>Worked example</summary>
        <p>
          Inputs:{' '}
          {Object.entries(card.worked_example.inputs)
            .map(([k, v]) => `${k} = ${v}`)
            .join(', ')}
        </p>
        <ol>
          {card.worked_example.steps.map((s) => (
            <li key={s}>
              <code>{s}</code>
            </li>
          ))}
        </ol>
        <p className="result">
          Result: {value === null ? 'Not available' : roundHalfUp(value, card.worked_example.decimals)}
        </p>
      </details>
      <p className="note">{card.interpretation.note}</p>
    </article>
  );
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const t = document.documentElement.dataset.theme;
    return t === 'light' || t === 'dark' ? t : 'system';
  });
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <h1>openpm-lens</h1>
        <label>
          Theme{' '}
          <select
            value={theme}
            onChange={(e) => {
              const t = e.target.value as Theme;
              setTheme(t);
              applyTheme(t);
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </header>
      <main id="main">
        <p className="lead">
          Your data stays on this device. Nothing is uploaded and nothing is tracked. Import and
          dashboards are coming next; for now, here are the metrics the app can calculate, each with
          a worked example you can follow step by step.
        </p>
        <h2>Metric library ({cards.length})</h2>
        <div className="grid">
          {cards.map((c) => (
            <MetricCardView key={c.id} id={c.id} />
          ))}
        </div>
      </main>
      <footer>
        <p>Open source, Apache-2.0. Thresholds shown are starting values, not a standard.</p>
      </footer>
    </>
  );
}
