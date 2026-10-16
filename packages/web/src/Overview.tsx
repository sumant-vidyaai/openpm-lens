import { assessHealth, DEFAULT_THRESHOLDS, HEALTH_LABEL, roundHalfUp, type Health } from '@openpm-lens/core';
import { IndexRuler } from './charts';
import type { SharedData } from './shared';
import { Readiness } from './Template';

const SYMBOL: Record<Health, string> = { green: '●', amber: '▲', red: '■', insufficient: '○' };
const BAND_TEXT: Record<Health, string> = { green: 'in the green zone', amber: 'in the amber zone', red: 'in the red zone', insufficient: 'not used (too few tasks)' };
const fmt = (n: number | null) => (n === null ? 'Not available' : String(roundHalfUp(n, 2)));

export interface Goto { id: string; label: string; why: string }
const NEXT: Goto[] = [
  { id: 'schedule', label: 'Schedule', why: 'On-time rate and overdue tasks' },
  { id: 'cost', label: 'Cost in money', why: 'Hours priced with your rates' },
  { id: 'resources', label: 'Resources', why: 'Who is overloaded, week by week' },
  { id: 'quality', label: 'Quality', why: 'Defects, age and resolution time' },
];

export function OverviewScreen({ shared, onGo }: { shared: SharedData | null; onGo: (id: string) => void }) {
  if (!shared) {
    return (
      <section aria-labelledby="ov-h" className="hero">
        <h2 id="ov-h">See where your project stands</h2>
        <p className="lead">Load a task export from the tool you already use. You get cost and schedule health, forecasts, flow, resources and quality, and every number comes with its working.</p>
        <p className="row">
          <button type="button" className="primary" onClick={() => onGo('import')}>Load a file</button>
          <button type="button" onClick={() => onGo('template')}>Get the fill-in template</button>
          <button type="button" onClick={() => onGo('learn')}>Read how the numbers work</button>
        </p>
        <ul className="plain">
          <li><strong>Health at a glance.</strong> One status from cost and schedule, with the reason in words.</li>
          <li><strong>Nothing is guessed.</strong> Missing values are left out and listed, never turned into zero.</li>
          <li><strong>Private.</strong> Your file is read in this browser tab and never uploaded. It works offline.</li>
        </ul>
        <p className="note">Works with CSV, Excel and Microsoft Project XML exports. Use "Try the made-up example" on the Import tab to see it with sample data first.</p>
      </section>
    );
  }
  const sm = shared.summary;
  const ts = shared.template?.settings;
  const fromTpl = ts != null && ts.greenMin !== null && ts.amberMin !== null;
  const th = fromTpl ? { ...DEFAULT_THRESHOLDS, greenMin: ts.greenMin as number, amberMin: ts.amberMin as number } : DEFAULT_THRESHOLDS;
  const h = assessHealth({ ev: sm.ev, ac: sm.ac, costTasks: sm.costTasks, evSchedule: sm.evSchedule, pv: sm.pv, scheduleTasks: sm.scheduleTasks }, th);
  return (
    <section aria-labelledby="ov-h">
      <h2 id="ov-h">Overview</h2>
      <p className="lead"><strong>{shared.fileName}</strong>{shared.statusDate ? `, as of ${shared.statusDate}` : '. Choose a status date on the Import tab to include schedule.'}</p>

      <div className={`band band-${h.health}`} role="status">
        <p className="band-main"><span aria-hidden="true" className="band-sym">{SYMBOL[h.health]}</span> <span>{HEALTH_LABEL[h.health]}</span></p>
        <ul className="plain">{h.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="note">Limits: green from {th.greenMin}, amber from {th.amberMin}, at least {th.minTasks} tasks. These are starting values, not a standard. {fromTpl ? "Set by the template's Settings sheet. " : ''}Change them on the Portfolio tab.</p>
      </div>

      <div className="rulers">
        <div className="panel"><h3>Cost: are we getting what we pay for?</h3>
          <IndexRuler name="CPI" value={h.cpi} greenMin={th.greenMin} amberMin={th.amberMin} band={BAND_TEXT[h.cpiBand]} />
          <p className="note">Cost performance index = earned value / actual cost. Above 1 means more work done than hours spent would predict.</p>
        </div>
        <div className="panel"><h3>Schedule: are we on pace?</h3>
          <IndexRuler name="SPI" value={h.spi} greenMin={th.greenMin} amberMin={th.amberMin} band={BAND_TEXT[h.spiBand]} />
          <p className="note">Schedule performance index = earned value / planned value. Below 1 means behind the plan.</p>
        </div>
      </div>

      {shared.template && <div className="panel"><Readiness readiness={shared.template.readiness} /></div>}

      <h3>Key numbers (hours)</h3>
      <dl className="facts">
        <div><dt>Planned value</dt><dd>{fmt(sm.pv)}</dd></div>
        <div><dt>Earned value</dt><dd>{fmt(sm.ev)}</dd></div>
        <div><dt>Actual cost</dt><dd>{fmt(sm.ac)}</dd></div>
        <div><dt>Budget (planned hours)</dt><dd>{fmt(sm.bac)}</dd></div>
        <div><dt>Tasks used for cost</dt><dd>{sm.costTasks} of {sm.tasksTotal}</dd></div>
        <div><dt>Tasks used for schedule</dt><dd>{sm.scheduleTasks} of {sm.tasksTotal}</dd></div>
      </dl>
      <p className="note">Forecast (EAC, ETC, VAC, TCPI), earned schedule and the working for every number are on the Import tab.</p>

      <h3>Look deeper</h3>
      <ul className="links">
        {NEXT.map((n) => <li key={n.id}><button type="button" onClick={() => onGo(n.id)}>{n.label}</button> <span className="note">{n.why}</span></li>)}
      </ul>
    </section>
  );
}
