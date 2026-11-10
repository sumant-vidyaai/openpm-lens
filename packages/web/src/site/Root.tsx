import { useEffect, useRef, useState } from 'react';
import { App } from '../App';
import { SiteShell } from './SiteShell';
import { HomePage } from './pages/HomePage';
import { ProductPage } from './pages/ProductPage';
import { HowPage } from './pages/HowPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { AboutPage } from './pages/AboutPage';

export type Route = 'home' | 'product' | 'how' | 'resources' | 'about' | 'app';
const PATHS: Record<Route, string> = { home: '#/', product: '#/product', how: '#/how-it-works', resources: '#/resources', about: '#/about', app: '#/app' };
export const href = (r: Route) => PATHS[r];
const TITLES: Record<Exclude<Route, 'app'>, string> = {
  home: 'Spashta: know where your project stands',
  product: 'What Spashta does',
  how: 'How Spashta works',
  resources: 'Templates and learning',
  about: 'About Spashta',
};

function parse(hash: string): Route {
  const h = hash.split('?')[0] ?? '';
  if (h.startsWith('#/app')) return 'app';
  if (h === '#/product') return 'product';
  if (h === '#/how-it-works') return 'how';
  if (h === '#/resources') return 'resources';
  if (h === '#/about') return 'about';
  return 'home';
}

/** The website sits in front of the app. The app stays mounted once opened, so a loaded project is kept while you read the site. */
export function Root() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  const [appOpened, setAppOpened] = useState(route === 'app');
  const [exampleSignal, setExampleSignal] = useState(0);
  const [goto, setGoto] = useState({ tab: '', n: 0 });
  const first = useRef(true);
  useEffect(() => {
    const on = () => {
      const r = parse(window.location.hash);
      setRoute(r);
      if (r === 'app') {
        setAppOpened(true);
        if (window.location.hash.includes('example')) setExampleSignal((n) => n + 1);
        const t = (window.location.hash.split('?')[0] ?? '').split('/')[2];
        if (t) setGoto((g) => ({ tab: t, n: g.n + 1 }));
      }
    };
    window.addEventListener('hashchange', on);
    if (window.location.hash.includes('example') && route === 'app') setExampleSignal(1);
    return () => window.removeEventListener('hashchange', on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    document.title = route === 'app' ? 'Spashta app' : TITLES[route];
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    requestAnimationFrame(() => document.getElementById(route === 'app' ? 'main' : 'page-h')?.focus({ preventScroll: true }));
  }, [route]);
  return (
    <>
      {route !== 'app' && (
        <SiteShell route={route}>
          {route === 'home' && <HomePage />}
          {route === 'product' && <ProductPage />}
          {route === 'how' && <HowPage />}
          {route === 'resources' && <ResourcesPage />}
          {route === 'about' && <AboutPage />}
        </SiteShell>
      )}
      {appOpened && <div hidden={route !== 'app'} className="app-root"><App exampleSignal={exampleSignal} goto={goto} /></div>}
    </>
  );
}
