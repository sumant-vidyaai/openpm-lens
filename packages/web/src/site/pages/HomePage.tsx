import { Frame, Gauge, Icon, ICONS, PrivacyDiagram } from '../art';
import { useReveal } from '../useReveal';
import { A, CtaBand, Faq, Journey } from './shared';
import { href } from '../Root';

const CHIPS = ['CSV', 'Excel (.xlsx)', 'Microsoft Project XML', 'Spashta template'];

export function HomePage() {
  useReveal();
  return (
    <>
      <section className="s-band s-ink s-hero" aria-labelledby="page-h">
        <div className="s-wrap s-hero-grid">
          <div className="s-hero-copy">
            <h1 id="page-h" tabIndex={-1}>Know where your project stands, and why.</h1>
            <p className="s-lead">Spashta reads the plan or task export you already have and tells you, in plain words, whether the project is on track. Every number comes with its working.</p>
            <p className="s-actions">
              <a className="s-btn s-btn-sun" href={A('app', true)}>Try the example</a>
              <a className="s-btn s-btn-line" href={href('how')}>See how it works</a>
            </p>
            <p className="s-micro">Free and open source. Nothing is uploaded.</p>
          </div>
          <div className="s-hero-art" aria-hidden="false">
            <span className="orb orb-red" aria-hidden="true" /><span className="orb orb-amber" aria-hidden="true" /><span className="orb orb-green" aria-hidden="true" />
            <Frame className="hero-frame" src="overview.webp" alt="The Spashta overview page for a made-up project: a red status band, the reasons in words and progress bars." eager />
            <p className="chip chip-1"><span className="dot dot-red" aria-hidden="true" />Red: off track</p>
            <p className="chip chip-2">CPI <strong>0.85</strong></p>
            <p className="chip chip-3">85% chance of finishing by <strong>2026-05-12</strong></p>
          </div>
        </div>
        <div className="s-wrap">
          <ul className="s-reads" aria-label="Files Spashta reads">
            <li className="s-reads-lead">Reads</li>
            {CHIPS.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      </section>

      <section className="s-band" aria-labelledby="q-h">
        <div className="s-wrap">
          <h2 id="q-h" className="s-h2">The three questions every status meeting asks</h2>
          <p className="s-sub">Spashta answers each one with a number, a colour and a sentence. These cards show a made-up example project.</p>
          <div className="q-grid">
            <article className="q-card reveal">
              <h3>Are we on budget?</h3>
              <Gauge label="Cost performance index" value={0.8468} />
              <p className="q-big">Each hour spent earned <strong>0.85</strong> hours of planned work.</p>
              <p className="q-small">326 hours of work earned for 385 hours spent.</p>
            </article>
            <article className="q-card reveal" style={{ ['--i' as string]: 1 }}>
              <h3>Are we on time?</h3>
              <Gauge label="Schedule performance index" value={0.84} />
              <p className="q-big">The work is finishing <strong>later</strong> than planned.</p>
              <p className="q-small">Green from 0.95, amber from 0.85. Your limits can differ.</p>
            </article>
            <article className="q-card reveal" style={{ ['--i' as string]: 2 }}>
              <h3>When will it finish?</h3>
              <div className="dots" role="img" aria-label="6 of 13 items done">
                {Array.from({ length: 13 }, (_, i) => <i key={i} className={i < 6 ? 'on' : ''} />)}
              </div>
              <p className="q-big"><strong>85%</strong> chance the last item finishes by 2026-05-12.</p>
              <p className="q-small">6 of 13 items done. The date comes from simulating your recent weekly pace.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="s-band s-tint" aria-labelledby="tour-h">
        <div className="s-wrap">
          <h2 id="tour-h" className="s-h2">One tool from the first idea to the final report</h2>
          <p className="s-sub">Real screens from the app, using the made-up example project.</p>
          <div className="bento">
            <a className="bento-tile reveal" href={href('product')}>
              <Frame src="overview.webp" alt="Overview page with a red status band and the reasons in words." />
              <h3>Status in words</h3><p>One health colour from cost and schedule, with the reasons written out.</p>
            </a>
            <a className="bento-tile reveal" style={{ ['--i' as string]: 1 }} href={href('product')}>
              <Frame src="initiate.webp" alt="Weighted scoring of options with ranks." />
              <h3>Choose and justify</h3><p>Weighted scoring, business case and stakeholder grid.</p>
            </a>
            <a className="bento-tile reveal" style={{ ['--i' as string]: 2 }} href={href('product')}>
              <Frame src="planning.webp" alt="Planning page with three-point estimates and the critical path." />
              <h3>Plan with ranges</h3><p>Three-point estimates, critical path and reserves.</p>
            </a>
            <a className="bento-tile reveal" style={{ ['--i' as string]: 3 }} href={href('product')}>
              <Frame src="schedule.webp" alt="Schedule page showing planned against actual dates and overdue tasks." />
              <h3>Track dates and cost</h3><p>What is overdue, what hours cost and who is overloaded.</p>
            </a>
            <a className="bento-tile reveal" style={{ ['--i' as string]: 4 }} href={href('product')}>
              <Frame src="close.webp" alt="Close and review page with a checklist and benefits." />
              <h3>Close with evidence</h3><p>Checklist, benefits delivered and lessons learned.</p>
            </a>
            <a className="bento-tile reveal" style={{ ['--i' as string]: 5 }} href={href('product')}>
              <Frame src="report.webp" alt="Status report page." />
              <h3>Report and trend</h3><p>A printable status report and trends from saved snapshots.</p>
            </a>
          </div>
          <p className="s-more"><a href={href('product')}>See everything it does</a></p>
        </div>
      </section>

      <section className="s-band" aria-labelledby="road-h">
        <div className="s-wrap">
          <h2 id="road-h" className="s-h2">Follow the project from idea to close</h2>
          <p className="s-sub">Each stage has its own page in the app. Start wherever your project is today.</p>
          <Journey />
        </div>
      </section>

      <section className="s-band s-ink s-working" aria-labelledby="work-h">
        <div className="s-wrap">
          <h2 id="work-h" className="s-h2">Never a black box</h2>
          <p className="s-sub">Every figure is shown with its working, so you can defend it in the meeting.</p>
          <p className="formula" role="img" aria-label="Cost performance index equals work earned divided by hours spent, 326 divided by 385, which is 0.85">
            <span className="f-name">CPI</span><span className="f-op">=</span>
            <span className="f-part f-a"><small>work earned</small>326</span><span className="f-op">÷</span>
            <span className="f-part f-b"><small>hours spent</small>385</span><span className="f-op">=</span>
            <span className="f-res">0.85</span>
          </p>
        </div>
      </section>

      <section className="s-band" aria-labelledby="priv-h">
        <div className="s-wrap s-split">
          <div>
            <h2 id="priv-h" className="s-h2">Your project never leaves your device</h2>
            <p className="s-sub">Spashta runs entirely in your browser. There is no upload, no account and no server holding your plan, so it is safe to use with a confidential project.</p>
            <ul className="ticks">
              <li>Works offline once loaded</li>
              <li>Open source, so anyone can check what it does</li>
              <li>Missing values are listed, never guessed</li>
            </ul>
          </div>
          <div className="s-art"><PrivacyDiagram /></div>
        </div>
      </section>

      <section className="s-band s-tint" aria-labelledby="for-h">
        <div className="s-wrap">
          <h2 id="for-h" className="s-h2">Made for people who report on projects</h2>
          <div className="aud">
            <article className="aud-card reveal"><Icon>{ICONS.eye}</Icon><h3>Project managers</h3><p>A status you can explain in one sentence, with the numbers behind it.</p></article>
            <article className="aud-card reveal" style={{ ['--i' as string]: 1 }}><Icon>{ICONS.scale}</Icon><h3>PMOs</h3><p>The same method and the same limits for every project, set once in the Settings sheet.</p></article>
            <article className="aud-card reveal" style={{ ['--i' as string]: 2 }}><Icon>{ICONS.book}</Icon><h3>People learning</h3><p>Plain-language terms and practice questions built on a worked example.</p></article>
          </div>
        </div>
      </section>

      <section className="s-band" aria-labelledby="faq-h">
        <div className="s-wrap">
          <h2 id="faq-h" className="s-h2">Questions</h2>
          <Faq />
        </div>
      </section>
      <CtaBand />
    </>
  );
}
