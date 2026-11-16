import { getPrefs } from './storage';

/*
 * Anonymous usage counts (GoatCounter).
 *
 * WHAT IS SENT: one of the fixed names below, and nothing else from the app. No file
 * names, roster contents, staff names, shift data, error text, feedback text, referrer
 * or screen size. As with any web request, the counting service sees the device's IP
 * address and browser type in transit; GoatCounter says it does not store the IP.
 *
 * WHERE: only COUNT_URL. The Content Security Policy in vite.config.ts allows this one
 * address and blocks every other outgoing connection. No third-party script is loaded.
 *
 * WHEN: production build only, and only while "Share anonymous usage counts" is on in
 * Settings. If the request is blocked or fails, nothing happens — the app never waits on it.
 *
 * To add an event, add its name to this list. Never build a name from user or file data.
 */
export const COUNT_URL = 'https://babasuhuyini.goatcounter.com/count';

export type AnalyticsEvent =
  | 'app_opened'
  | 'import_started'
  | 'import_succeeded'
  | 'import_failed_scan'
  | 'import_failed_unsupported'
  | 'import_failed_protected'
  | 'import_failed_timeout'
  | 'import_failed_other'
  | 'feedback_prompt_shown'
  | 'feedback_opened';

export function analyticsEnabled(): boolean {
  return getPrefs().analytics !== false;
}

export function track(event: AnalyticsEvent): void {
  try {
    if (!import.meta.env.PROD || !analyticsEnabled()) return;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
    const isView = event === 'app_opened';
    const q = new URLSearchParams({ p: isView ? '/app' : event, t: isView ? 'App opened' : event, rnd: Math.random().toString(36).slice(2, 8) });
    if (!isView) q.set('e', 'true');
    void fetch(`${COUNT_URL}?${q}`, { mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true }).catch(() => {});
  } catch {
    /* counting is optional */
  }
}

/** Broad, fixed category for a failed import — derived from our own error titles, never from file data. */
export function failureEvent(title: string, timedOut: boolean): AnalyticsEvent {
  if (timedOut) return 'import_failed_timeout';
  if (/scanned|photo/i.test(title)) return 'import_failed_scan';
  if (/password/i.test(title)) return 'import_failed_protected';
  if (/supported|recognised|empty|too large/i.test(title)) return 'import_failed_unsupported';
  return 'import_failed_other';
}
