import { normName } from './interpret/draft';
import type { Assignment, ISODate, Person, Roster, SelectedNurse } from './types';

export type Tone = 'morning' | 'afternoon' | 'night' | 'shift' | 'off' | 'leave' | 'unassigned' | 'unknown';

/** Visual family for an assignment. Always shown together with its text label. */
export function toneOf(a: Pick<Assignment, 'kind' | 'label' | 'code' | 'overnight'>): Tone {
  if (a.kind !== 'shift') return a.kind;
  const l = `${a.label} ${a.code ?? ''}`.toLowerCase();
  if (/night/.test(l) || a.overnight) return 'night';
  if (/after|evening|late|\bpm\b/.test(l)) return 'afternoon';
  if (/morn|early|\bam\b|day/.test(l)) return 'morning';
  return 'shift';
}

const sameDetails = (a: Person['details'], b: SelectedNurse['details']) =>
  a.length === b.length && a.every((d, i) => d.value.trim().toLowerCase() === b[i].value.trim().toLowerCase());

/**
 * Find the saved nurse in a (possibly new) roster.
 * Returns exactly one person, or null if there's no exact, unambiguous match —
 * the app then asks rather than guessing.
 */
export function findSelected(roster: Roster, sel: SelectedNurse | undefined): Person | null {
  if (!sel) return null;
  const byName = roster.people.filter((p) => normName(p.name) === normName(sel.name));
  const byDetails = byName.filter((p) => sameDetails(p.details, sel.details));
  if (byDetails.length === 1) return byDetails[0];
  if (byDetails.length > 1) {
    const byRow = byDetails.filter((p) => p.row === sel.row);
    return byRow.length === 1 ? byRow[0] : null;
  }
  return null;
}

export function toSelected(p: Person): SelectedNurse {
  return { name: p.name, details: p.details, row: p.row };
}

/** Names that occur more than once — shown with row numbers. */
export function duplicateNames(roster: Roster): Set<string> {
  const seen = new Map<string, number>();
  for (const p of roster.people) seen.set(normName(p.name), (seen.get(normName(p.name)) ?? 0) + 1);
  return new Set([...seen].filter(([, n]) => n > 1).map(([k]) => k));
}

export function personLabel(p: Person, dupes: Set<string>): string {
  const details = p.details.map((d) => d.value).join(' · ');
  const row = dupes.has(normName(p.name)) ? `row ${p.row}` : '';
  return [details, row].filter(Boolean).join(' · ');
}

export function assignmentsOn(roster: Roster, personId: string, date: ISODate): Assignment[] {
  return (roster.entries[personId] ?? []).filter((a) => a.date === date);
}

export interface DayGroup {
  key: string;
  kind: Assignment['kind'];
  label: string;
  start?: string;
  end?: string;
  overnight?: boolean;
  code?: string;
  people: { person: Person; a: Assignment }[];
}

/** Everyone on a date, grouped by shift (in roster code order), then off/leave/unassigned/unrecognised. */
export function groupsOn(roster: Roster, date: ISODate): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const p of roster.people) {
    for (const a of assignmentsOn(roster, p.id, date)) {
      const key =
        a.kind === 'shift' ? `shift:${a.code}:${a.start ?? ''}:${a.end ?? ''}` : a.kind === 'leave' ? `leave:${a.label}` : a.kind === 'unknown' ? `unknown:${a.raw}` : a.kind;
      if (!groups.has(key)) {
        groups.set(key, { key, kind: a.kind, label: a.label, start: a.start, end: a.end, overnight: a.overnight, code: a.code, people: [] });
      }
      groups.get(key)!.people.push({ person: p, a });
    }
  }
  const codeOrder = new Map(roster.codes.map((c, i) => [c.key, i]));
  const kindRank: Record<Assignment['kind'], number> = { shift: 0, unknown: 1, leave: 2, off: 3, unassigned: 4 };
  return [...groups.values()].sort(
    (a, b) =>
      kindRank[a.kind] - kindRank[b.kind] ||
      (codeOrder.get(a.code ?? '') ?? 99) - (codeOrder.get(b.code ?? '') ?? 99) ||
      (a.start ?? '').localeCompare(b.start ?? '') ||
      a.label.localeCompare(b.label),
  );
}

/** Group consecutive days with the same leave/off label into ranges. */
export function rangesOf(list: Assignment[]): { from: ISODate; to: ISODate; label: string; kind: Assignment['kind']; days: number }[] {
  const out: { from: ISODate; to: ISODate; label: string; kind: Assignment['kind']; days: number }[] = [];
  for (const a of list) {
    const last = out[out.length - 1];
    if (last && last.label === a.label && last.kind === a.kind && nextDay(last.to) === a.date) {
      last.to = a.date;
      last.days++;
    } else out.push({ from: a.date, to: a.date, label: a.label, kind: a.kind, days: 1 });
  }
  return out;
}

function nextDay(d: ISODate): ISODate {
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Other people on exactly the same shift (code and start time) as this assignment. */
export function colleaguesOn(roster: Roster, me: Person, a: Assignment): Person[] {
  return roster.people.filter(
    (p) => p.id !== me.id && assignmentsOn(roster, p.id, a.date).some((x) => x.kind === 'shift' && x.code === a.code && x.start === a.start),
  );
}

/** Short text for a calendar cell or week tile; always shown with the shift icon. */
export function shortMark(a: Assignment): string {
  switch (a.kind) {
    case 'shift':
      return a.code && a.code.length <= 3 ? a.code : a.label.slice(0, 3);
    case 'off':
      return 'Off';
    case 'leave':
      return 'Leave';
    case 'unassigned':
      return '–';
    default:
      return '?';
  }
}
