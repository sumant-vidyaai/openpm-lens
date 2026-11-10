import { Icon, ICONS } from '../art';
import { useReveal } from '../useReveal';
import { CtaBand, PageHero } from './shared';

const B = import.meta.env.BASE_URL;
export function ResourcesPage() {
  useReveal();
  const cards = [
    { icon: ICONS.file, t: 'Fill-in template', p: 'An Excel workbook with one sheet each for tasks, settings, rates, holidays, leave, risks, issues, changes, scoring, a business case, stakeholders, RFI-RFP, go or no-go, checklist, lessons and benefits.', links: [{ l: 'Download .xlsx', h: `${B}templates/spashta-template.xlsx`, d: true }, { l: 'Download .csv', h: `${B}templates/spashta-template.csv`, d: true }] },
    { icon: ICONS.grid, t: 'Worked example', p: 'The same workbook filled in for a made-up project, so you can see what good data looks like and open it in the app.', links: [{ l: 'Download .xlsx', h: `${B}templates/spashta-example.xlsx`, d: true }, { l: 'Open it in the app', h: '#/app?example' }] },
    { icon: ICONS.book, t: 'Learn and practise', p: 'Plain-language terms, a short glossary for each stage, and practice questions with a four-step case study.', links: [{ l: 'Open Learn', h: '#/app/learn' }] },
    { icon: ICONS.scale, t: 'Metric library', p: 'The metrics Spashta can calculate, each with its formula and what it means.', links: [{ l: 'Open the library', h: '#/app/library' }] },
    { icon: ICONS.eye, t: 'Tool coverage', p: 'What Spashta covers across the project lifecycle and what it does not, so you know where it fits next to your other tools.', links: [{ l: 'See coverage', h: '#/app/coverage' }] },
    { icon: ICONS.lock, t: 'Privacy and promises', p: 'What Spashta never does with your data, and how every number is worked out.', links: [{ l: 'Read the promises', h: '#/about' }] },
  ];
  return (
    <>
      <PageHero title="Templates and learning" lead="Everything you need to prepare a file, understand the numbers and teach others." />
      <section className="s-band" aria-label="Resources">
        <div className="s-wrap">
          <div className="res-grid">
            {cards.map((c, i) => (
              <article key={c.t} className="res-card reveal" style={{ ['--i' as string]: i % 3 }}>
                <span className="res-icon"><Icon size={26}>{c.icon}</Icon></span>
                <h2>{c.t}</h2>
                <p>{c.p}</p>
                <p className="res-links">{c.links.map((l) => <a key={l.l} href={l.h} {...(l.d ? { download: true } : {})}>{l.l}</a>)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <CtaBand title="Not sure where to start?" text="Open the example project and click through every stage." />
    </>
  );
}
