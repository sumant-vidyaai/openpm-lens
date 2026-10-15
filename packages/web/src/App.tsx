import { useState } from 'react';
import { metricFunctions, roundHalfUp } from '@openpm-lens/core';
import { cards } from './cards';
import { ImportScreen } from './Import';
import { CoverageScreen } from './Coverage';
import { PortfolioScreen } from './Portfolio';
import { FlowScreen } from './Flow';
import { ScheduleScreen } from './ScheduleScreen';
import { CostScreen } from './CostScreen';
import { ResourceScreen } from './ResourceScreen';
import type { SharedData } from './shared';

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

type TabId = 'import' | 'portfolio' | 'flow' | 'schedule' | 'cost' | 'resources' | 'coverage' | 'library';
const TABS: { id: TabId; label: string }[] = [
  { id: 'import', label: 'Import' }, { id: 'portfolio', label: 'Portfolio' }, { id: 'flow', label: 'Flow metrics' },
  { id: 'schedule', label: 'Schedule' }, { id: 'cost', label: 'Cost in money' }, { id: 'resources', label: 'Resources' },
  { id: 'coverage', label: 'Tool coverage' }, { id: 'library', label: 'Metric library' },
];

export function App() {
  const [tab, setTab] = useState<TabId>('import');
  const [shared, setShared] = useState<SharedData | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const t = document.documentElement.dataset.theme;
    return t === 'light' || t === 'dark' ? t : 'system';
  });
  const goImport = () => setTab('import');
  // Every tab stays mounted (just hidden) so what you loaded and typed is kept when you switch.
  const panel = (id: TabId, node: React.ReactNode) => <div hidden={tab !== id}>{node}</div>;
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <h1>openpm-lens</h1>
        <label className="noprint">
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
        <nav className="tabs noprint" aria-label="Sections">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        {panel('import', <ImportScreen onShare={setShared} />)}
        {panel('portfolio', <PortfolioScreen />)}
        {panel('flow', <FlowScreen />)}
        {panel('schedule', <ScheduleScreen shared={shared} onGoImport={goImport} />)}
        {panel('cost', <CostScreen shared={shared} onGoImport={goImport} />)}
        {panel('resources', <ResourceScreen shared={shared} onGoImport={goImport} />)}
        {panel('coverage', <CoverageScreen />)}
        {panel('library', (
          <>
            <p className="lead">
              Your data stays on this device. Nothing is uploaded and nothing is tracked. Here are the metrics
              the app can calculate, each with a worked example you can follow step by step.
            </p>
            <h2>Metric library ({cards.length})</h2>
            <div className="grid">
              {cards.map((c) => (
                <MetricCardView key={c.id} id={c.id} />
              ))}
            </div>
          </>
        ))}
      </main>
      <footer>
        <p>Open source, Apache-2.0. Thresholds shown are starting values, not a standard.</p>
      </footer>
    </>
  );
}
