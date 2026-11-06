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
