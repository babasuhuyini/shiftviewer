/*
 * Appearance (light / dark / follow the device) and colour palette.
 *
 * The colours themselves live only in src/styles.css as theme tokens, keyed by
 * `data-theme` and `data-palette` on <html>. This module just decides which
 * attributes to set. public/theme-init.js does the same before the app loads,
 * so the first paint already has the right colours — keep the two in sync.
 */

export type Appearance = 'light' | 'dark' | 'system';
export type Palette = 'stone' | 'rose' | 'sage' | 'ocean' | 'sand';

export interface PaletteInfo {
  id: Palette;
  name: string;
  description: string;
}

export const DEFAULT_PALETTE: Palette = 'stone';
export const DEFAULT_APPEARANCE: Appearance = 'system';

export const PALETTES: PaletteInfo[] = [
  { id: 'stone', name: 'Stone', description: 'Soft greys with a slate accent' },
  { id: 'rose', name: 'Rose & plum', description: 'The original warm pink and plum' },
  { id: 'sage', name: 'Sage', description: 'Calm green-grey' },
  { id: 'ocean', name: 'Ocean', description: 'Cool, quiet blue' },
  { id: 'sand', name: 'Sand', description: 'Warm neutral with a caramel accent' },
];

export const APPEARANCES: { id: Appearance; name: string }[] = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
  { id: 'system', name: 'System' },
];

const isPalette = (v: unknown): v is Palette => PALETTES.some((p) => p.id === v);
const isAppearance = (v: unknown): v is Appearance => APPEARANCES.some((a) => a.id === v);

export interface ThemeChoice {
  appearance: Appearance;
  palette: Palette;
}

/** Sanitise whatever was stored (it may be from an older version or edited by hand). */
export function normaliseTheme(raw: { appearance?: unknown; palette?: unknown }): ThemeChoice {
  return {
    appearance: isAppearance(raw.appearance) ? raw.appearance : DEFAULT_APPEARANCE,
    palette: isPalette(raw.palette) ? raw.palette : DEFAULT_PALETTE,
  };
}

const darkQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

export function resolveMode(appearance: Appearance): 'light' | 'dark' {
  if (appearance === 'system') return darkQuery()?.matches ? 'dark' : 'light';
  return appearance;
}

/** Apply a choice to the document immediately. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  const mode = resolveMode(choice.appearance);
  root.dataset.theme = mode;
  root.dataset.palette = choice.palette;
  root.style.colorScheme = mode;
  // Match the browser UI (address bar on phones) to the page background.
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg) {
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.removeAttribute('media');
      m.content = bg;
    });
  }
}

/** Re-apply when the device switches between light and dark (only matters for "System"). */
export function watchSystemMode(onChange: () => void): () => void {
  const mq = darkQuery();
  if (!mq) return () => {};
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
