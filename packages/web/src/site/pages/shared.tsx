import type { ReactNode } from 'react';
import { href, type Route } from '../Root';
import { Icon, ICONS } from '../art';

export const A = (r: Route, example = false) => (example ? `${href(r)}?example` : href(r));

export function PageHero({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <section className="s-band s-ink s-pagehero">
      <div className="s-wrap">
        <h1 id="page-h" tabIndex={-1}>{title}</h1>
        <p className="s-lead">{lead}</p>
        {children}
      </div>
    </section>
  );
}

export const STEPS = [
  { id: 'initiate', n: 'Initiate', text: 'Score vendors and options, test the business case, map who matters.', icon: ICONS.start },
  { id: 'planning', n: 'Plan', text: 'Three-point estimates, the critical path and reserves.', icon: ICONS.plan },
  { id: 'schedule', n: 'Track', text: 'Planned against actual dates, cost, workload and flow.', icon: ICONS.track },
  { id: 'raid', n: 'Control', text: 'Risks, issues, changes and a forecast with odds.', icon: ICONS.control },
  { id: 'close', n: 'Close', text: 'Closing checklist, benefits delivered, lessons learned.', icon: ICONS.close },
  { id: 'report', n: 'Report', text: 'A status report and trends from saved snapshots.', icon: ICONS.report },
];

export function Journey() {
  return (
    <ol className="journey-road">
      {STEPS.map((s, i) => (
        <li key={s.id} className="reveal" style={{ ['--i' as string]: i }}>
          <a href={`#/app/${s.id}`}>
            <span className="jr-dot"><Icon size={22}>{s.icon}</Icon></span>
            <span className="jr-n">Step {i + 1}</span>
            <strong>{s.n}</strong>
            <span className="jr-t">{s.text}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

const FAQ: { q: string; a: string }[] = [
  { q: 'Is my project data uploaded anywhere?', a: 'No. The file is read inside your browser tab and never leaves your device. Once the app has loaded it also works offline.' },
  { q: 'Which files can I load?', a: 'CSV, Excel (.xlsx) and Microsoft Project XML. There is also a fill-in Excel template with sheets for tasks, risks, issues, changes, scoring, a business case, stakeholders, a closing checklist, lessons and benefits.' },
  { q: 'Do I have to use your template?', a: 'No. Any task export works and you map the columns once on the Import page. The template is there if you would rather keep everything in one file.' },
  { q: 'Who decides the green, amber and red limits?', a: 'You do. The limits shown are starting values, not a standard. Weights, scores, discount rate and similar judgement values are always entered by you and never filled in for you.' },
  { q: 'What happens when a value is missing?', a: 'It is left out and listed, never turned into zero. A project with too few tasks is reported as not enough data rather than guessed.' },
  { q: 'Is it free?', a: 'Yes. Spashta is open source under the Apache-2.0 licence.' },
];

export function Faq() {
  return (
    <div className="s-faq">
      {FAQ.map((f) => (
        <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
      ))}
    </div>
  );
}

export function CtaBand({ title = 'See it on a made-up project', text = 'It loads in a second, and every page then has something to show.' }: { title?: string; text?: string }) {
  return (
    <section className="s-band s-sun s-cta" aria-labelledby="cta-h">
      <div className="s-wrap">
        <h2 id="cta-h">{title}</h2>
        <p>{text}</p>
        <p className="s-actions">
          <a className="s-btn s-btn-ink" href={A('app', true)}>Try the example</a>
          <a className="s-btn s-btn-line-ink" href={`${import.meta.env.BASE_URL}templates/spashta-template.xlsx`} download>Download the template</a>
        </p>
      </div>
    </section>
  );
}
