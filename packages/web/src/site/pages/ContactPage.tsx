import { CONTACT_EMAIL } from '../config';
import { PageHero } from './shared';

const mail = (subject: string, body: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export function ContactPage() {
  return (
    <>
      <PageHero title="Contact" lead="Ask a question, report a problem, or tell us what you need Spashta to do." />
      <section className="s-band" aria-labelledby="ct-h">
        <div className="s-wrap s-prose">
          <h2 id="ct-h" className="s-h2">Write to us</h2>
          {CONTACT_EMAIL === '' ? (
            <p>Contact details are being set up. Please check back soon.</p>
          ) : (
            <>
              <p>Each button opens your email program with a short outline to fill in. Please do not send project files or confidential data by email; describe the problem in words or use made-up figures.</p>
              <p className="s-actions">
                <a className="s-btn s-btn-accent" href={mail('Spashta: a question', 'What I was trying to do:\n\nWhat happened:\n\n')}>Ask a question</a>{' '}
                <a className="s-btn" href={mail('Spashta: customization request', 'The tool or report I use today:\n\nWhat I need Spashta to do:\n\nWho would use it:\n\n')}>Request a customization</a>
              </p>
              <p>Or write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We read every message; replies can take a few working days.</p>
            </>
          )}
          <h2 className="s-h2">Customization requests</h2>
          <p>If your tool exports a task list that Spashta does not read well, or you need a view that is missing, tell us which tool, which columns it exports and what you would like to see. A made-up sample of the first row of the export is the most useful thing you can send.</p>
        </div>
      </section>
    </>
  );
}
