import type { Draft, DraftEntry, LeaveGap, LeaveProposal } from '../types';

/**
 * Rosters often spell leave across day cells, one letter per cell:
 *   A | N | N | U | A | L |   |   | L | E | A | V | E
 * Read cell by cell, "A" would look like Afternoon and "N" like Night.
 * This finds those words so the user can confirm them as leave.
 */

/** Words and the leave type they name (null = generic word, inherits the type). */
export const LEAVE_WORDS: Record<string, string | null> = {
  ANNUAL: 'Annual leave',
  MATERNITY: 'Maternity leave',
  PATERNITY: 'Paternity leave',
  SICK: 'Sick leave',
  STUDY: 'Study leave',
  CASUAL: 'Casual leave',
  COMPASSIONATE: 'Compassionate leave',
  EXCUSE: 'Excuse duty',
  EXCUSED: 'Excuse duty',
  VACATION: 'Vacation',
  HOLIDAY: 'Holiday',
  PUBLIC: 'Public holiday',
  TRAINING: 'Training',
  COURSE: 'Course',
  WORKSHOP: 'Workshop',
  LEAVE: null,
  DUTY: null,
};
const WORDS = Object.keys(LEAVE_WORDS);

interface Match {
  len: number;
  words: string[];
  fullWords: number;
  partial: boolean;
}

/** Longest stretch of s from `start` that is made of leave words. */
function longestWords(s: string, start: number, allowSuffixAtStart: boolean, allowPrefixAtEnd: boolean): Match | null {
  let best: Match | null = null;
  const consider = (m: Match) => {
    if (!best || m.len > best.len || (m.len === best.len && m.fullWords > best.fullWords)) best = m;
  };
  const go = (pos: number, words: string[], full: number, partial: boolean) => {
    if (pos > start) consider({ len: pos - start, words, fullWords: full, partial });
    if (pos >= s.length) return;
    for (const w of WORDS) {
      if (s.startsWith(w, pos)) go(pos + w.length, [...words, w], full + 1, partial);
    }
    // A word cut off by the start of the roster (e.g. "UAL" from "ANNUAL").
    if (pos === start && allowSuffixAtStart) {
      for (const w of WORDS) {
        for (let k = 2; k < w.length; k++) {
          if (s.startsWith(w.slice(-k), pos)) go(pos + k, [w], full, true);
        }
      }
    }
    // A word cut off by the end of the roster (e.g. "L" from "LEAVE").
    if (allowPrefixAtEnd) {
      const rest = s.slice(pos);
      for (const w of WORDS) {
        if (rest.length < w.length && w.startsWith(rest)) consider({ len: s.length - start, words: [...words, w], fullWords: full, partial: true });
      }
    }
  };
  go(start, [], 0, false);
  return best;
}

const letterOf = (e: DraftEntry) => (/^[A-Za-z]$/.test(e.raw.trim()) ? e.raw.trim().toUpperCase() : null);

export function detectLeave(draft: Draft): { proposals: LeaveProposal[]; gaps: LeaveGap[] } {
  if (draft.layout !== 'grid') return { proposals: [], gaps: [] };
  const proposals: LeaveProposal[] = [];
  const gaps: LeaveGap[] = [];

  for (const person of draft.people) {
    const entries = [...person.entries].sort((a, b) => a.seq - b.seq);
    if (!entries.length) continue;
    const minSeq = entries[0].seq;
    const maxSeq = entries[entries.length - 1].seq;

    // Runs of consecutive single-letter cells.
    const runs: DraftEntry[][] = [];
    let cur: DraftEntry[] = [];
    for (const e of entries) {
      const prev = cur[cur.length - 1];
      if (letterOf(e) && (!prev || e.seq === prev.seq + 1)) cur.push(e);
      else {
        if (cur.length) runs.push(cur);
        cur = letterOf(e) ? [e] : [];
      }
    }
    if (cur.length) runs.push(cur);

    const full: LeaveProposal[] = [];
    const partialOnly: LeaveProposal[] = [];
    for (const run of runs) {
      const s = run.map((e) => letterOf(e)!).join('');
      const atStart = run[0].seq === minSeq;
      const atEnd = run[run.length - 1].seq === maxSeq;
      let i = 0;
      while (i < s.length) {
        const m = longestWords(s, i, i === 0 && atStart, atEnd);
        const isFull = m && m.fullWords >= 1 && m.len >= 4;
        const isBoundaryPartial = m && m.fullWords === 0 && m.partial;
        if (m && (isFull || isBoundaryPartial)) {
          const cells = run.slice(i, i + m.len);
          const p: LeaveProposal = {
            id: `${person.key}:${cells[0].seq}`,
            personKey: person.key,
            fromSeq: cells[0].seq,
            toSeq: cells[cells.length - 1].seq,
            letters: s.slice(i, i + m.len),
            label: m.words.map((w) => LEAVE_WORDS[w]).find(Boolean) ?? '',
            partial: m.partial,
            allBold: cells.every((c) => c.bold),
            accepted: true,
          };
          (isFull ? full : partialOnly).push(p);
          i += m.len;
        } else {
          i++;
        }
      }
    }
    // Cut-off fragments only count when the same row clearly spells leave elsewhere.
    const mine = full.length ? [...full, ...partialOnly].sort((a, b) => a.fromSeq - b.fromSeq) : [];
    // Generic words ("LEAVE") take the type of the nearest named word in the row.
    mine.forEach((p, idx) => {
      if (p.label) return;
      const before = mine.slice(0, idx).reverse().find((q) => q.label);
      const after = mine.slice(idx + 1).find((q) => q.label);
      p.label = before?.label || after?.label || 'Leave';
    });
    proposals.push(...mine);

    // Blank days sitting between two leave words in the same row.
    for (let k = 0; k + 1 < mine.length; k++) {
      const a = mine[k];
      const b = mine[k + 1];
      const between = entries.filter((e) => e.seq > a.toSeq && e.seq < b.fromSeq);
      if (between.length && between.every((e) => !e.raw.trim())) {
        gaps.push({ personKey: person.key, seqs: between.map((e) => e.seq), label: a.label, between: [a.id, b.id], asLeave: false });
      }
    }
  }
  return { proposals, gaps };
}

/** person → seq → leave label, for accepted proposals and gaps the user marked as leave. */
export function leaveCells(proposals: LeaveProposal[], gaps: LeaveGap[]): Map<string, Map<number, { label: string; via: 'leave-word' | 'leave-gap' }>> {
  const out = new Map<string, Map<number, { label: string; via: 'leave-word' | 'leave-gap' }>>();
  const get = (k: string) => {
    if (!out.has(k)) out.set(k, new Map());
    return out.get(k)!;
  };
  for (const p of proposals) {
    if (!p.accepted) continue;
    for (let s = p.fromSeq; s <= p.toSeq; s++) get(p.personKey).set(s, { label: p.label, via: 'leave-word' });
  }
  const accepted = new Set(proposals.filter((p) => p.accepted).map((p) => p.id));
  for (const g of gaps) {
    // Only when the user opted in AND both neighbouring words were accepted.
    if (!g.asLeave || !accepted.has(g.between[0]) || !accepted.has(g.between[1])) continue;
    for (const s of g.seqs) get(g.personKey).set(s, { label: g.label, via: 'leave-gap' });
  }
  return out;
}
