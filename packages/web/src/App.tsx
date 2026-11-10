import { useEffect, useState } from 'react';
import { metricFunctions, roundHalfUp } from '@spashta/core';
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
import { PlanningScreen } from './Planning';
import { InitiateScreen } from './Initiate';
import { CloseScreen } from './Close';
import { StatusReportScreen } from './StatusReport';
import { StatusStrip } from './StatusStrip';
import { TrendsScreen } from './Trends';
import type { Lifecycle, SharedData } from './shared';
import { AppActions } from './common';

type Theme = 'system' | 'light' | 'dark';

function applyTheme(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === 'system') { localStorage.removeItem('spashta-theme'); localStorage.removeItem('openpm-lens-theme'); }
    else localStorage.setItem('spashta-theme', theme);
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

type TabId = 'overview' | 'import' | 'template' | 'portfolio' | 'flow' | 'schedule' | 'cost' | 'resources' | 'quality' | 'raid' | 'forecast' | 'planning' | 'initiate' | 'close' | 'report' | 'trends' | 'learn' | 'coverage' | 'library';
const GROUPS: { title: string; tabs: { id: TabId; label: string }[] }[] = [
  { title: 'Start', tabs: [{ id: 'overview', label: 'Overview' }, { id: 'import', label: 'Import' }, { id: 'template', label: 'Template' }] },
  { title: 'Initiate', tabs: [{ id: 'initiate', label: 'Choose and justify' }] },
  { title: 'Plan and track', tabs: [{ id: 'planning', label: 'Planning' }, { id: 'schedule', label: 'Schedule' }, { id: 'cost', label: 'Cost in money' }, { id: 'resources', label: 'Resources' }, { id: 'flow', label: 'Flow metrics' }] },
  { title: 'Control', tabs: [{ id: 'quality', label: 'Quality' }, { id: 'raid', label: 'Risks, issues, changes' }, { id: 'forecast', label: 'Forecast' }] },
  { title: 'Close', tabs: [{ id: 'close', label: 'Close and review' }] },
  { title: 'Report', tabs: [{ id: 'report', label: 'Status report' }, { id: 'trends', label: 'Snapshots and trends' }] },
  { title: 'Portfolio', tabs: [{ id: 'portfolio', label: 'Portfolio' }] },
  { title: 'Learn', tabs: [{ id: 'learn', label: 'Learn' }, { id: 'coverage', label: 'Tool coverage' }, { id: 'library', label: 'Metric library' }] },
];
type Accent = 'teal' | 'blue' | 'violet' | 'orange';
function applyAccent(a: Accent) {
  if (a === 'teal') delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = a;
  try { if (a === 'teal') { localStorage.removeItem('spashta-accent'); localStorage.removeItem('openpm-lens-accent'); } else localStorage.setItem('spashta-accent', a); } catch { /* ignore */ }
}


export function App({ exampleSignal = 0, goto }: { exampleSignal?: number; goto?: { tab: string; n: number } }) {
  const [tab, setTab] = useState<TabId>('overview');
  const [shared, setShared] = useState<SharedData | null>(null);
  const [life, setLife] = useState<Lifecycle | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const t = document.documentElement.dataset.theme;
    return t === 'light' || t === 'dark' ? t : 'system';
  });
  const [accent, setAccent] = useState<Accent>(() => {
    const a = document.documentElement.dataset.accent;
    return a === 'blue' || a === 'violet' || a === 'orange' ? a : 'teal';
  });
  const [exampleTick, setExampleTick] = useState(0);
  const [lastInGroup, setLastInGroup] = useState<Record<string, TabId>>({});
  const goImport = () => choose('import');
  const actions = { tryExample: () => { setExampleTick((n) => n + 1); setTab('import'); } };
  useEffect(() => { if (exampleSignal > 0) actions.tryExample(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exampleSignal]);
  useEffect(() => { const t = goto && GROUPS.flatMap((g) => g.tabs).find((x) => x.id === goto.tab); if (t) choose(t.id); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goto?.n]);
  // Every tab stays mounted (just hidden) so what you loaded and typed is kept when you switch.
  const panel = (id: TabId, node: React.ReactNode) => <div hidden={tab !== id}>{node}</div>;
  const group = GROUPS.find((g) => g.tabs.some((t) => t.id === tab)) ?? GROUPS[0]!;
  const openGroup = (title: string) => {
    const g = GROUPS.find((x) => x.title === title);
    if (g) setTab(lastInGroup[title] ?? g.tabs[0]!.id);
  };
  const choose = (id: TabId) => { setTab(id); setLastInGroup((m) => ({ ...m, [GROUPS.find((g) => g.tabs.some((t) => t.id === id))?.title ?? '']: id })); };
  return (
    <AppActions.Provider value={actions}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar noprint">
        <div className="topbar-in">
          <h1 className="brand"><a href="#/" aria-label="Spashta by Vidyaai, back to the website"><span aria-hidden="true" className="brand-mark" />Spashta<span className="brand-by"> by Vidyaai</span></a></h1>
          <nav className="groups" aria-label="Sections">
            {GROUPS.map((g) => (
              <button key={g.title} type="button" aria-current={g.title === group.title ? 'true' : undefined} onClick={() => openGroup(g.title)}>{g.title}</button>
            ))}
          </nav>
          <details className="appearance">
            <summary>Appearance</summary>
            <div className="appearance-panel">
              <label>
                Theme{' '}
                <select value={theme} onChange={(e) => { const t = e.target.value as Theme; setTheme(t); applyTheme(t); }}>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <label>
                Accent colour{' '}
                <select value={accent} onChange={(e) => { const a = e.target.value as Accent; setAccent(a); applyAccent(a); }}>
                  <option value="teal">Teal</option>
                  <option value="blue">Blue</option>
                  <option value="violet">Violet</option>
                  <option value="orange">Orange</option>
                </select>
              </label>
            </div>
          </details>
        </div>
        {group.tabs.length > 1 && (
          <nav className="pages" aria-label={`${group.title} pages`}>
            <div className="pages-in">
              {group.tabs.map((t) => (
                <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => choose(t.id)}>{t.label}</button>
              ))}
            </div>
          </nav>
        )}
      </header>
      <div className="content">
      <StatusStrip shared={shared} />
      <main id="main" tabIndex={-1}>
        <h1 className="printonly">Spashta</h1>
        {panel('overview', <OverviewScreen shared={shared} onGo={(id) => setTab(id as TabId)} onTryExample={() => setExampleTick((n) => n + 1)} />)}
        {panel('import', <ImportScreen onShare={setShared} onLifecycle={setLife} exampleTick={exampleTick} />)}
        {panel('template', <TemplateScreen onGoImport={goImport} />)}
        {panel('portfolio', <PortfolioScreen />)}
        {panel('flow', <FlowScreen />)}
        {panel('schedule', <ScheduleScreen shared={shared} onGoImport={goImport} />)}
        {panel('cost', <CostScreen shared={shared} onGoImport={goImport} />)}
        {panel('resources', <ResourceScreen shared={shared} onGoImport={goImport} />)}
        {panel('quality', <QualityScreen shared={shared} onGoImport={goImport} />)}
        {panel('raid', <RaidScreen shared={shared} onGoImport={goImport} onGoTemplate={() => setTab('template')} />)}
        {panel('initiate', <InitiateScreen shared={shared} life={life} onGoImport={goImport} onGoTemplate={() => setTab('template')} />)}
        {panel('planning', <PlanningScreen shared={shared} onGoImport={goImport} />)}
        {panel('close', <CloseScreen shared={shared} life={life} onGoImport={goImport} onGoTemplate={() => setTab('template')} />)}
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
      <footer className="site-footer noprint">
        <div className="footer-in">
          <div className="footer-about">
            <p className="footer-brand"><strong>Spashta</strong> by Vidyaai</p>
            <p>Open source, Apache-2.0. Your data stays on this device and is never uploaded. Colour limits shown are starting values, not a standard.</p>
          </div>
          <nav aria-label="Product"><h2 className="footer-h">Product</h2>
            <ul className="footer-links">
              <li><a href="#/">Back to the website</a></li>
              <li><button type="button" className="link" onClick={() => choose('overview')}>Overview</button></li>
              <li><button type="button" className="link" onClick={() => choose('import')}>Import a file</button></li>
              <li><button type="button" className="link" onClick={() => choose('template')}>Fill-in template</button></li>
            </ul></nav>
          <nav aria-label="Learn"><h2 className="footer-h">Learn</h2>
            <ul className="footer-links">
              <li><button type="button" className="link" onClick={() => choose('learn')}>Learn and practice</button></li>
              <li><button type="button" className="link" onClick={() => choose('library')}>Metric library</button></li>
              <li><button type="button" className="link" onClick={() => choose('coverage')}>Tool coverage</button></li>
            </ul></nav>
          <nav aria-label="Project"><h2 className="footer-h">Project</h2>
            <ul className="footer-links">
              <li><a href="https://github.com/sumant-vidyaai/spashta">Source code</a></li>
            </ul></nav>
        </div>
      </footer>
      </div>
    </AppActions.Provider>
  );
}
