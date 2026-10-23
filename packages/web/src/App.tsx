import { useState } from 'react';
import { metricFunctions, roundHalfUp } from '@openpm-lens/core';
import { cards } from './cards';
import { ImportScreen } from './Import';
import { CoverageScreen } from './Coverage';
import { TemplateScreen } from './Template';
import { PortfolioScreen } from './Portfolio';
import { FlowScreen } from './Flow';
import { ScheduleScreen } from './ScheduleScreen';
import { CostScreen } from './CostScreen';
import { ResourceScreen } from './ResourceScreen';
import { QualityScreen } from './QualityScreen';
import { LearnScreen } from './Learn';
import { OverviewScreen } from './Overview';
import { RaidScreen } from './Raid';
import { ForecastScreen } from './Forecast';
import { StatusReportScreen } from './StatusReport';
import { TrendsScreen } from './Trends';
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

type TabId = 'overview' | 'import' | 'template' | 'portfolio' | 'flow' | 'schedule' | 'cost' | 'resources' | 'quality' | 'raid' | 'forecast' | 'report' | 'trends' | 'learn' | 'coverage' | 'library';
const GROUPS: { title: string; tabs: { id: TabId; label: string }[] }[] = [
  { title: 'Start', tabs: [{ id: 'overview', label: 'Overview' }, { id: 'import', label: 'Import' }, { id: 'template', label: 'Template' }, { id: 'portfolio', label: 'Portfolio' }] },
  { title: 'Analyse', tabs: [{ id: 'flow', label: 'Flow metrics' }, { id: 'schedule', label: 'Schedule' }, { id: 'cost', label: 'Cost in money' }, { id: 'resources', label: 'Resources' }, { id: 'quality', label: 'Quality' }, { id: 'raid', label: 'Risks, issues, changes' }, { id: 'forecast', label: 'Forecast' }, { id: 'report', label: 'Status report' }, { id: 'trends', label: 'Snapshots and trends' }] },
  { title: 'Learn', tabs: [{ id: 'learn', label: 'Learn' }, { id: 'coverage', label: 'Tool coverage' }, { id: 'library', label: 'Metric library' }] },
];

export function App() {
  const [tab, setTab] = useState<TabId>('overview');
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
      <div className="shell">
        <aside className="side noprint">
          <h1 className="brand"><span aria-hidden="true" className="brand-mark" />openpm-lens</h1>
          <nav className="tabs side-nav" aria-label="Sections">
            {GROUPS.map((g) => (
              <div key={g.title} className="side-group">
                <p className="side-title">{g.title}</p>
                {g.tabs.map((t) => (
                  <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
              </div>
            ))}
          </nav>
          <label className="theme">
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
        </aside>
        <div className="content">
      <main id="main">
        <h1 className="printonly">openpm-lens</h1>
        {panel('overview', <OverviewScreen shared={shared} onGo={(id) => setTab(id as TabId)} />)}
        {panel('import', <ImportScreen onShare={setShared} />)}
        {panel('template', <TemplateScreen onGoImport={goImport} />)}
        {panel('portfolio', <PortfolioScreen />)}
        {panel('flow', <FlowScreen />)}
        {panel('schedule', <ScheduleScreen shared={shared} onGoImport={goImport} />)}
        {panel('cost', <CostScreen shared={shared} onGoImport={goImport} />)}
        {panel('resources', <ResourceScreen shared={shared} onGoImport={goImport} />)}
        {panel('quality', <QualityScreen shared={shared} onGoImport={goImport} />)}
        {panel('raid', <RaidScreen shared={shared} onGoImport={goImport} onGoTemplate={() => setTab('template')} />)}
        {panel('forecast', <ForecastScreen shared={shared} onGoImport={goImport} />)}
        {panel('report', <StatusReportScreen shared={shared} onGoImport={goImport} />)}
        {panel('trends', <TrendsScreen shared={shared} onGoImport={goImport} />)}
        {panel('learn', <LearnScreen />)}
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
        <p>Open source, Apache-2.0. Your data stays on this device. Thresholds shown are starting values, not a standard.</p>
      </footer>
        </div>
      </div>
    </>
  );
}
