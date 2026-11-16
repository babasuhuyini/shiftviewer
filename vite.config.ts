/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Production-only Content Security Policy.
 * `connect-src` allows exactly one address: the anonymous usage counter (src/lib/analytics.ts),
 * which is sent fixed event names only. Every other fetch, XHR, WebSocket or beacon is blocked,
 * and no code path sends roster data anywhere.
 * (Not applied in dev because Vite's hot-reload needs a WebSocket.)
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src https://babasuhuyini.goatcounter.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

/**
 * Production-only service worker (dist/sw.js) so the saved home-screen app opens offline.
 *  - Precaches the app shell (page, main script, styles, basic fonts, icons).
 *  - Pages: network first, so a new deploy shows up on the next online open; cached copy offline.
 *  - /assets/ files have content-hashed names, so they are cached on first use and never go stale.
 * Only same-origin GET requests for the app's own files are handled. No roster data is involved.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'emit-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const shell = Object.values(bundle)
        .filter((f) => (f.type === 'chunk' && f.isEntry) || /\.css$/.test(f.fileName) || /fraunces-latin-wght-.*\.woff2$/.test(f.fileName))
        .map((f) => './' + f.fileName);
      const precache = ['./', './theme-init.js', './manifest.webmanifest', './icons/icon-192.png', ...shell];
      const source = `const CACHE = 'my-shifts-${Date.now().toString(36)}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('my-shifts-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const put = (res) => {
    if (res.ok) caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? './' : req, res.clone()));
    return res;
  };
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(put)));
  } else {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req.mode === 'navigate' ? './' : req).then((hit) => hit || Response.error())));
  }
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative base so the build works on GitHub Pages under any repository name.
  base: './',
  plugins: [react(), cspPlugin(), serviceWorkerPlugin()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
