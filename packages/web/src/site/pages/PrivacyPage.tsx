import { CONTACT_EMAIL, LAST_UPDATED_PRIVACY } from '../config';
import { PageHero } from './shared';

export function PrivacyPage() {
  return (
    <>
      <PageHero title="Privacy" lead="What stays on your device, what is stored in your browser, and what we can see." />
      <section className="s-band" aria-labelledby="pv-h">
        <div className="s-wrap s-prose">
          <p className="note">Last updated {LAST_UPDATED_PRIVACY}.</p>
          <h2 id="pv-h" className="s-h2">Your project data</h2>
          <p>Spashta runs in your browser. The files you load (task exports, workbooks, archives) are read in your browser tab and are never uploaded. No server of ours receives your tasks, costs, risks or any other project content, and there is no account.</p>
          <h2 className="s-h2">What your browser stores</h2>
          <ul className="ticks">
            <li>Your appearance choice (light, dark or automatic).</li>
            <li>Snapshots you choose to save on the Trends tab, kept in this browser only.</li>
            <li>A copy of the app's own files, so it can work offline.</li>
          </ul>
          <p>This stays on your device. You can remove it by clearing this site's data in your browser settings.</p>
          <h2 className="s-h2">Visit counts</h2>
          <p>We use Cloudflare Web Analytics to count visits to this website (for example how many people open a page). Cloudflare states that this service does not use cookies or local storage for analytics and does not track individual visitors across time. It sees which pages are opened and technical details such as browser type and country; it never sees the files you load or anything you type into the app.</p>
          <h2 className="s-h2">Email</h2>
          <p>{CONTACT_EMAIL === '' ? 'If you write to us, we use your message and address only to reply.' : <>If you write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, we use your message and address only to reply. Please do not send confidential project data.</>}</p>
          <h2 className="s-h2">Hosting</h2>
          <p>The website is served by Cloudflare. As with any website, the host's servers handle the request for the page itself.</p>
          <h2 className="s-h2">Changes</h2>
          <p>If this page changes, the date above changes with it.</p>
        </div>
      </section>
    </>
  );
}
