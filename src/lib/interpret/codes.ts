import type { CodeDef, CodeKind, Draft } from '../types';

export const normCode = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase();

export interface CodeStat {
  key: string;
  count: number;
  /** Raw spellings seen, e.g. "x" and "X". */
  variants: string[];
  /** Some of the cells came from merged cells. */
  merged: number;
}

export function collectCodes(
  draft: Draft,
  leaveMap: Map<string, Map<number, unknown>>,
): { codes: CodeStat[]; blankCount: number } {
  const stats = new Map<string, CodeStat>();
  let blankCount = 0;
  for (const p of draft.people) {
    const leave = leaveMap.get(p.key);
    for (const e of p.entries) {
      if (e.seq >= 0 && leave?.has(e.seq)) continue;
      const raw = e.raw.trim();
      if (!raw) {
        blankCount++;
        continue;
      }
      const key = normCode(raw);
      const s = stats.get(key) ?? { key, count: 0, variants: [], merged: 0 };
      s.count++;
      if (!s.variants.includes(raw)) s.variants.push(raw);
      if (e.merged) s.merged++;
      stats.set(key, s);
    }
  }
  return { codes: [...stats.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)), blankCount };
}

/** Common codes. Always shown as suggestions the user must confirm — facilities differ. */
const SUGGESTIONS: Record<string, Omit<CodeDef, 'key'>> = {
  M: { kind: 'shift', label: 'Morning' },
  A: { kind: 'shift', label: 'Afternoon' },
  N: { kind: 'shift', label: 'Night', overnight: true },
  D: { kind: 'shift', label: 'Day' },
  MORNING: { kind: 'shift', label: 'Morning' },
  AFTERNOON: { kind: 'shift', label: 'Afternoon' },
  EVENING: { kind: 'shift', label: 'Evening' },
  NIGHT: { kind: 'shift', label: 'Night', overnight: true },
  X: { kind: 'off', label: 'Off' },
  OFF: { kind: 'off', label: 'Off' },
  'DAY OFF': { kind: 'off', label: 'Off' },
  DO: { kind: 'off', label: 'Off' },
  AL: { kind: 'leave', label: 'Annual leave' },
  'A/L': { kind: 'leave', label: 'Annual leave' },
  ML: { kind: 'leave', label: 'Maternity leave' },
  SL: { kind: 'leave', label: 'Sick leave' },
};

export type CodeOrigin = 'remembered' | 'suggested' | 'new';

export interface CodeDraft extends Omit<CodeDef, 'kind'> {
  kind: CodeKind | null;
  origin: CodeOrigin;
  count: number;
  variants: string[];
  merged: number;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function suggestCodes(stats: CodeStat[], remembered: CodeDef[]): CodeDraft[] {
  return stats.map((s) => {
    const base = { key: s.key, count: s.count, variants: s.variants, merged: s.merged };
    const rem = remembered.find((r) => r.key === s.key);
    if (rem) return { ...base, ...rem, key: s.key, origin: 'remembered' as const };
    const sug = SUGGESTIONS[s.key];
    if (sug) return { ...base, ...sug, origin: 'suggested' as const };
    if (/\b(leave|vacation|holiday|maternity|annual|sick)\b/i.test(s.key)) {
      return { ...base, kind: 'leave' as const, label: titleCase(s.key), origin: 'suggested' as const };
    }
    return { ...base, kind: null, label: s.variants[0] ?? s.key, origin: 'new' as const };
  });
}

const ORDER_HINT = ['morning', 'early', 'day', 'afternoon', 'late', 'evening', 'night'];

/** Display order: shifts by start time (or a natural Morning→Night order), then off, leave, unknown. */
export function sortCodes(codes: CodeDef[]): CodeDef[] {
  const kindRank: Record<CodeKind, number> = { shift: 0, off: 1, leave: 2, unknown: 3 };
  const hint = (c: CodeDef) => {
    const i = ORDER_HINT.findIndex((h) => c.label.toLowerCase().includes(h));
    return i < 0 ? 99 : i;
  };
  return [...codes].sort((a, b) => {
    if (kindRank[a.kind] !== kindRank[b.kind]) return kindRank[a.kind] - kindRank[b.kind];
    if (a.kind === 'shift') {
      if (a.start && b.start && a.start !== b.start) return a.start.localeCompare(b.start);
      if (hint(a) !== hint(b)) return hint(a) - hint(b);
    }
    return a.key.localeCompare(b.key);
  });
}

export function isOvernight(c: Pick<CodeDef, 'start' | 'end' | 'overnight'>): boolean {
  if (c.start && c.end) return c.end <= c.start;
  return !!c.overnight;
}
