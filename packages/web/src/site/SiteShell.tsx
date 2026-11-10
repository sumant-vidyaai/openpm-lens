import { useState, type ReactNode } from 'react';
import { Mark } from './art';
import { href, type Route } from './Root';

const LINKS: { route: Route; label: string }[] = [
  { route: 'home', label: 'Home' },
  { route: 'product', label: 'Product' },
  { route: 'how', label: 'How it works' },
  { route: 'resources', label: 'Resources' },
  { route: 'about', label: 'About' },
  { route: 'contact', label: 'Contact' },
];

export function SiteShell({ route, children }: { route: Route; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="site">
      <a className="skip" href="#page-h">Skip to content</a>
      <header className="s-header">
        <div className="s-header-in">
          <a className="s-logo" href={href('home')} aria-label="Spashta by Vidyaai, home"><Mark /><span>Spashta</span></a>
          <button type="button" className="s-burger" aria-expanded={open} aria-controls="s-nav" onClick={() => setOpen((o) => !o)}>{open ? 'Close menu' : 'Menu'}</button>
          <nav id="s-nav" className={`s-nav ${open ? 'open' : ''}`} aria-label="Website">
            <ul>
              {LINKS.map((l) => (
                <li key={l.route}><a href={href(l.route)} aria-current={l.route === route ? 'page' : undefined} onClick={() => setOpen(false)}>{l.label}</a></li>
              ))}
            </ul>
            <a className="s-btn s-btn-accent" href={href('app')} onClick={() => setOpen(false)}>Open the app</a>
          </nav>
        </div>
      </header>
      <main className="s-main">{children}</main>
      <footer className="s-footer">
        <div className="s-wrap s-footer-grid">
          <div className="s-footer-about">
            <p className="s-footer-logo"><Mark size={32} /><span>Spashta</span></p>
            <p>Project status you can explain in one sentence. Made by Vidyaai. It runs in your browser, so your project stays on your device.</p>
          </div>
          <nav aria-label="Footer pages"><h2>Explore</h2>
            <ul>{LINKS.map((l) => <li key={l.route}><a href={href(l.route)}>{l.label}</a></li>)}</ul>
          </nav>
          <nav aria-label="Use Spashta"><h2>Use it</h2>
            <ul>
              <li><a href={`${href('app')}?example`}>Try the example</a></li>
              <li><a href={href('app')}>Open the app</a></li>
              <li><a href={`${import.meta.env.BASE_URL}templates/spashta-template.xlsx`} download>Fill-in template</a></li>
              <li><a href={href('resources')}>Learning resources</a></li>
            </ul>
          </nav>
          <nav aria-label="Project"><h2>Project</h2>
            <ul>
              <li><a href={href('about')}>Our promises</a></li>
              <li><a href={href('privacy')}>Privacy</a></li>
              <li><a href={href('contact')}>Contact</a></li>
            </ul>
          </nav>
        </div>
        <div className="s-wrap s-footer-base"><p>© 2026 Vidyaai. All rights reserved. Your project data stays on your device. Colour limits shown are starting values, not a standard.</p></div>
      </footer>
    </div>
  );
}
