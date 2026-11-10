import { Frame } from '../art';
import { useReveal } from '../useReveal';
import { A, CtaBand, PageHero } from './shared';

const ROWS: { id: string; title: string; text: string; points: string[]; img: string; alt: string; app: string }[] = [
  { id: 'status', title: 'Status in words', text: 'Cost and schedule indexes are combined into one health colour. The reason is written out and the limits are yours to change.', points: ['Green, amber or red with a symbol, so colour is never the only signal', 'Progress bars for items done, work earned and hours spent', 'Look at one group, such as a person or team'], img: 'overview.webp', alt: 'Overview page: a red status band with the reasons in words, and progress bars.', app: 'overview' },
  { id: 'initiate', title: 'Choose and justify', text: 'Compare vendors and options fairly, test the business case and see who needs what from you.', points: ['Weighted scoring where a missing score is never treated as zero', 'Net present value, return on investment, payback and benefit-cost ratio', 'Stakeholder grid by power and interest, and a go or no-go record'], img: 'initiate.webp', alt: 'Choose and justify page with weighted scores, ranks and a business case.', app: 'initiate' },
  { id: 'planning', title: 'Plan with ranges, not wishes', text: 'Three-point estimates, the longest chain of dependent tasks and the reserves you set aside.', points: ['Three-point (PERT) estimates', 'Critical path with dates', 'Contingency and management reserves checked against the forecast overrun'], img: 'planning.webp', alt: 'Planning page with three-point estimates, the critical path and reserves.', app: 'planning' },
  { id: 'schedule', title: 'Track dates, cost and people', text: 'See what is overdue, what hours cost with your own rates, and who is overloaded week by week.', points: ['Planned against actual dates and overdue tasks', 'Hours priced with your own rate table', 'Workload by person, week by week, and flow metrics such as cycle time'], img: 'schedule.webp', alt: 'Schedule page showing planned against actual dates and overdue tasks.', app: 'schedule' },
  { id: 'control', title: 'Control risks, issues and change', text: 'Know which risks matter most and how far the plan has moved from where it started.', points: ['Risk ranking by likelihood and impact', 'Issues and change requests in one place', 'A forecast that gives odds, not a single hopeful date'], img: 'raid.webp', alt: 'Risks, issues and changes page.', app: 'raid' },
  { id: 'close', title: 'Close with evidence', text: 'End a project properly: what was finished, which benefits arrived and what to do differently next time.', points: ['Closing checklist; items marked not applicable are left out of the count', 'Benefits planned against realised, never added across different units', 'A printable closure report and a zip archive made on your device'], img: 'close.webp', alt: 'Close and review page with a closing checklist, benefits and lessons.', app: 'close' },
  { id: 'report', title: 'Report and watch the trend', text: 'A status report you can print, and snapshots that show whether things are getting better or worse.', points: ['A status report you can print, written from your numbers', 'Save a snapshot each reporting period', 'Trend charts across snapshots'], img: 'report.webp', alt: 'Status report page.', app: 'report' },
];

export function ProductPage() {
  useReveal();
  return (
    <>
      <PageHero title="Everything a status meeting needs, in one place" lead="Seven jobs, one browser tab, no accounts. Each screen below is the real app with a made-up example project." />
      <nav className="s-band s-subnav" aria-label="On this page"><div className="s-wrap"><ul>{ROWS.map((r) => <li key={r.id}><a href={`#/product`} onClick={(e) => { e.preventDefault(); document.getElementById(r.id)?.scrollIntoView({ behavior: 'smooth' }); }}>{r.title}</a></li>)}</ul></div></nav>
      {ROWS.map((r, i) => (
        <section key={r.id} id={r.id} className={`s-band ${i % 2 ? 's-tint' : ''}`} aria-labelledby={`${r.id}-h`}>
          <div className={`s-wrap s-feature ${i % 2 ? 'flip' : ''}`}>
            <div className="s-feature-text reveal">
              <h2 id={`${r.id}-h`} className="s-h2">{r.title}</h2>
              <p className="s-sub">{r.text}</p>
              <ul className="ticks">{r.points.map((p) => <li key={p}>{p}</li>)}</ul>
              <p><a className="s-btn s-btn-accent" href={`#/app/${r.app}?example`}>Open this in the example</a></p>
            </div>
            <div className="reveal" style={{ ['--i' as string]: 1 }}><Frame src={r.img} alt={r.alt} /></div>
          </div>
        </section>
      ))}
      <CtaBand title="Try every screen yourself" text="The example project fills every page, so you can click around before using your own file." />
    </>
  );
}
