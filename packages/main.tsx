import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './site/Root';
import './styles.css';
import './site/site.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is optional */
    });
  });
}
