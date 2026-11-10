import { Icon, ICONS, MissingDiagram } from '../art';
import { useReveal } from '../useReveal';
import { A, CtaBand, Journey, PageHero } from './shared';
import { href } from '../Root';

export function HowPage() {
  useReveal();
  return (
    <>
      <PageHero title="How Spashta works" lead="Three steps from a file to a status you can explain. No set-up, no account.">
        <p className="s-actions"><a className="s-btn s-btn-sun" href={A('app', true)}>Try the example</a><a className="s-btn s-btn-line" href={href('resources')}>Get the template</a></p>
      </PageHero>

      <section className="s-band" aria-labelledby="three-h">
        <div className="s-wrap">
          <h2 id="three-h" className="s-h2">Load, check, read</h2>
          <ol className="three">
            <li className="reveal"><span className="three-n" aria-hidden="true">1</span><Icon size={34}>{ICONS.upload}</Icon><h3>Load a file</h3><p>Drop in a CSV, an Excel file or a Microsoft Project XML export. Match your columns to Spashta's once; it remembers nothing about your project afterwards.</p></li>
            <li className="reveal" style={{ ['--i' as string]: 1 }}><span className="three-n" aria-hidden="true">2</span><Icon size={34}>{ICONS.check}</Icon><h3>Check what it understood</h3><p>Spashta lists what it read, what it left out and why. A blank is never turned into zero, and a missing date is reported, not invented.</p></li>
            <li className="reveal" style={{ ['--i' as string]: 2 }}><span className="three-n" aria-hidden="true">3</span><Icon size={34}>{ICONS.read}</Icon><h3>Read the status</h3><p>Get a colour, a sentence and the working for every number, then explore cost, schedule, risks, forecast and more.</p></li>
          </ol>
        </div>
      </section>

      <section className="s-band s-tint" aria-labelledby="miss-h">
        <div className="s-wrap s-split">
          <div>
            <h2 id="miss-h" className="s-h2">Nothing is guessed</h2>
            <p className="s-sub">Status tools often fill gaps quietly. Spashta does the opposite: where a value is missing, the result says so.</p>
            <ul className="ticks">
              <li>Blank is not zero</li>
              <li>Weights, scores, discount rate and colour limits are yours to enter</li>
              <li>Totals add the amounts first, then divide; ratios are never averaged</li>
            </ul>
          </div>
          <div className="s-art"><MissingDiagram /></div>
        </div>
      </section>

      <section className="s-band" aria-labelledby="road-h">
        <div className="s-wrap">
          <h2 id="road-h" className="s-h2">Then follow the project through its life</h2>
          <p className="s-sub">The same file and the same settings carry you from the first decision to the closing report.</p>
          <Journey />
        </div>
      </section>

      <section className="s-band s-ink s-working" aria-labelledby="work-h">
        <div className="s-wrap">
          <h2 id="work-h" className="s-h2">The working is always on show</h2>
          <p className="s-sub">An example from the made-up project: two performance indexes, each a plain ratio.</p>
          <div className="s-two-formulas">
            <p className="formula" role="img" aria-label="Cost performance index equals work earned divided by hours spent, 326 divided by 385, which is 0.85">
              <span className="f-name">CPI</span><span className="f-op">=</span><span className="f-part f-a"><small>work earned</small>326</span><span className="f-op">÷</span><span className="f-part f-b"><small>hours spent</small>385</span><span className="f-op">=</span><span className="f-res">0.85</span>
            </p>
          </div>
          <p className="s-note">Above 1 means better than plan. Spashta shows green from 0.95 and red below 0.85 by default; those limits are starting values you can change.</p>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
