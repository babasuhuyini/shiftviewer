import type { Appearance, Palette } from './theme';
import type { BlankMeaning, CodeDef, Roster, SelectedNurse } from './types';

/*
 * Everything is stored only in this browser on this device:
 *  - the confirmed roster in IndexedDB,
 *  - small preferences (selected nurse, shift-code settings, appearance) in localStorage.
 * Nothing is sent anywhere. "Remove roster" deletes the roster and the selected nurse only;
 * appearance and palette choices are kept because they contain no roster data.
 */

const DB_NAME = 'my-shifts';
const STORE = 'kv';
const ROSTER_KEY = 'roster';
/** Also read by public/theme-init.js (before the app loads) — keep the key in sync. */
export const PREFS_KEY = 'myShifts.prefs.v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

export async function loadRoster(): Promise<Roster | null> {
  try {
    const r = await tx<Roster | undefined>('readonly', (s) => s.get(ROSTER_KEY) as IDBRequest<Roster | undefined>);
    return r && r.schema === 1 ? r : null;
  } catch {
    return null;
  }
}

export async function saveRoster(roster: Roster): Promise<void> {
  await tx('readwrite', (s) => s.put(roster, ROSTER_KEY));
  // Ask the browser not to clear our storage under pressure (best effort, no prompt on most browsers).
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
}

export async function clearRoster(): Promise<void> {
  await tx('readwrite', (s) => s.delete(ROSTER_KEY));
  const p = getPrefs();
  delete p.nurse;
  setPrefs(p);
}

export interface Prefs {
  nurse?: SelectedNurse;
  codes?: CodeDef[];
  blankMeaning?: BlankMeaning;
  view?: 'calendar' | 'agenda';
  /** Light, dark, or follow the device. Kept when a roster is removed. */
  appearance?: Appearance;
  /** Colour palette name. Kept when a roster is removed. */
  palette?: Palette;
}

export function getPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : {};
  } catch {
    return {};
  }
}

export function setPrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode) — app still works for this session */
  }
}

export function updatePrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  setPrefs(next);
  return next;
}
