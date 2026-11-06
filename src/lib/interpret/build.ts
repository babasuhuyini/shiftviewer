import { findMonthYear, parseTimeText } from '../dates';
import type { Assignment, BlankMeaning, CodeDef, Draft, Extraction, Issue, Person, RawTable, Roster } from '../types';
import { isOvernight, normCode, sortCodes } from './codes';

export interface BuildInput {
  extraction: Extraction;
  table: RawTable;
  draft: Draft;
  codes: CodeDef[];
  blankMeaning: BlankMeaning;
  leaveMap: Map<string, Map<number, { label: string; via: 'leave-word' | 'leave-gap' }>>;
}

export interface BuildStats {
  people: number;
  days: number;
  shift: number;
  off: number;
  leave: number;
  unassigned: number;
  unknown: number;
}

const BLANK: Record<BlankMeaning, Pick<Assignment, 'kind' | 'label'>> = {
  unassigned: { kind: 'unassigned', label: 'No shift assigned' },
  off: { kind: 'off', label: 'Off (blank on roster)' },
  unknown: { kind: 'unknown', label: 'Blank on roster' },
};

export function buildRoster(input: BuildInput): { roster: Roster; stats: BuildStats; checks: Issue[] } {
  const { extraction, table, draft, blankMeaning, leaveMap } = input;
  const codes = sortCodes(input.codes);
  const byKey = new Map(codes.map((c) => [c.key, c]));
  const stats: BuildStats = { people: draft.people.length, days: draft.dates.length, shift: 0, off: 0, leave: 0, unassigned: 0, unknown: 0 };

  const people: Person[] = [];
  const entries: Record<string, Assignment[]> = {};

  for (const p of draft.people) {
    people.push({ id: p.key, name: p.name, details: p.details, row: p.row });
    const leave = leaveMap.get(p.key);
    const list: Assignment[] = p.entries.map((e) => {
      const raw = e.raw.trim();
      const lv = e.seq >= 0 ? leave?.get(e.seq) : undefined;
      if (lv) return { date: e.date, raw, kind: 'leave', label: lv.label, via: lv.via };
      if (!raw) return { date: e.date, raw: '', ...BLANK[blankMeaning], via: 'blank' };
      const def = byKey.get(normCode(raw));
      const via = e.merged ? 'merged-cell' : 'cell';
      if (!def || def.kind === 'unknown') {
        return { date: e.date, raw, kind: 'unknown', code: def?.key, label: def?.label && def.label !== raw ? def.label : raw, via };
      }
      // Times written in the file (list layout) win over the code's usual times.
      const start = parseTimeText(e.startText ?? '') ?? def.start;
      const end = parseTimeText(e.endText ?? '') ?? def.end;
      return {
        date: e.date,
        raw,
        kind: def.kind,
        code: def.key,
        label: def.label,
        start: def.kind === 'shift' ? start : undefined,
        end: def.kind === 'shift' ? end : undefined,
        overnight: def.kind === 'shift' ? isOvernight({ start, end, overnight: def.overnight }) : undefined,
        via,
      };
    });
    list.sort((a, b) => a.date.localeCompare(b.date));
    for (const a of list) stats[a.kind]++;
    entries[p.key] = list;
  }

  const title = extraction.contextText.find((t) => t.length <= 140 && findMonthYear(t)) ?? extraction.contextText.find((t) => t.length <= 140);
  const notes = [
    ...extraction.warnings,
    ...table.notes,
    ...draft.issues.filter((i) => i.level !== 'info').map((i) => i.message),
  ];

  const roster: Roster = {
    schema: 1,
    fileName: extraction.fileName,
    format: extraction.format,
    tableLabel: table.label,
    title,
    importedAt: new Date().toISOString(),
    period: { start: draft.dates[0], end: draft.dates[draft.dates.length - 1] },
    people,
    codes,
    blankMeaning,
    entries,
    notes,
  };
  return { roster, stats, checks: summaryCheck(draft, roster) };
}

/**
 * Compare totals rows at the bottom of the roster (e.g. "MORNING 4 5 6 …") with the
 * names actually listed. Informational only: the individual rows are always what's used.
 */
export function summaryCheck(draft: Draft, roster: Roster): Issue[] {
  const out: Issue[] = [];
  for (const row of draft.summaryRows) {
    const label = row.label.trim().toLowerCase();
    if (!label) continue;
    const code = roster.codes.find((c) => c.kind === 'shift' && (c.label.toLowerCase() === label || c.key.toLowerCase() === label));
    if (!code) continue;
    let compared = 0;
    let mismatched = 0;
    for (const [date, value] of row.values) {
      const expected = Number(value);
      if (!value || Number.isNaN(expected)) continue;
      compared++;
      const actual = roster.people.filter((p) => roster.entries[p.id].some((a) => a.date === date && a.code === code.key && a.kind === 'shift')).length;
      if (actual !== expected) mismatched++;
    }
    if (!compared) continue;
    out.push(
      mismatched
        ? {
            level: 'info',
            message: `The “${row.label}” totals row in the file doesn’t match the names listed on ${mismatched} of ${compared} days. The app uses each person’s own row and ignores the totals.`,
          }
        : { level: 'info', message: `The “${row.label}” totals row matches the names listed on all ${compared} days.` },
    );
  }
  return out;
}
