import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Bundled with the app (no font CDN): elegant serif for headings and the welcome note.
import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline support for the saved (home-screen) app: the service worker keeps a copy of the
// app's own files on this device. It never touches roster data and sends nothing anywhere.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is optional — the app works without it */
    });
  });
}
