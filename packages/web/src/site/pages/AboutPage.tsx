import { Icon, ICONS, Mark } from '../art';
import { useReveal } from '../useReveal';
import { CtaBand, PageHero } from './shared';

export function AboutPage() {
  useReveal();
  const promises = [
    { icon: ICONS.lock, t: 'Nothing is uploaded', p: 'Your file is read in your browser tab. No server receives it, there is no account and no copy is kept anywhere else.' },
    { icon: ICONS.eye, t: 'Nothing is guessed', p: 'Missing values are left out and listed. A blank is never turned into zero.' },
    { icon: ICONS.scale, t: 'Judgement stays yours', p: 'Weights, scores, discount rates and the limits for green, amber and red are entered by you. They are never filled in for you.' },
    { icon: ICONS.code, t: 'The working is shown', p: 'Every number comes with its formula, so you can check it and defend it in the meeting.' },
  ];
  return (
    <>
      <PageHero title="About Spashta" lead="Spashta is the Hindi and Sanskrit word for clear. We built it to make project status clear for the people who have to report it." />
      <section className="s-band" aria-labelledby="why-h">
        <div className="s-wrap s-prose">
          <h2 id="why-h" className="s-h2">Why it exists</h2>
          <p>Status reports are often built from whatever the tool shows, with hidden assumptions and numbers nobody can reproduce. Spashta takes a plain export and applies well-known, published project-management formulas, then shows the working so you can defend every figure.</p>
          <p>It is made by Vidyaai as a learning and knowledge-sharing tool for project managers, PMOs and portfolio leads.</p>
        </div>
      </section>
      <section className="s-band s-tint" aria-labelledby="prom-h">
        <div className="s-wrap">
          <h2 id="prom-h" className="s-h2">Four promises</h2>
          <div className="prom-grid">
            {promises.map((p, i) => (
              <article key={p.t} className="aud-card reveal" style={{ ['--i' as string]: i % 2 }}><Icon>{p.icon}</Icon><h3>{p.t}</h3><p>{p.p}</p></article>
            ))}
          </div>
        </div>
      </section>
      <section className="s-band" aria-labelledby="next-h">
        <div className="s-wrap s-prose">
          <h2 id="next-h" className="s-h2">What is planned next</h2>
          <p>These are plans, not promises, and the order may change:</p>
          <ul className="ticks">
            <li>Ready-made connections for more project tools</li>
            <li>Simple pricing: a free version and a paid version for the advanced tabs</li>
            <li>More learning material and worked examples</li>
          </ul>
          <p className="about-mark"><Mark size={40} /><span>Spashta by Vidyaai. © 2026 Vidyaai. All rights reserved.</span></p>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
