import type { RawCell, RawTable } from '../types';

/** Collapse whitespace (incl. non-breaking spaces) and trim. */
export function clean(s: string): string {
  return s.replace(/[\s   ]+/g, ' ').trim();
}

/** Pad rows to the same width and drop fully empty trailing rows/columns. */
export function finalizeTable(t: RawTable): RawTable {
  const width = Math.max(0, ...t.rows.map((r) => r.length));
  let rows = t.rows.map((r) => {
    const out = r.slice();
    while (out.length < width) out.push({ text: '' });
    return out;
  });
  const isEmpty = (c: RawCell) => !c.text && !c.mergedFrom;
  while (rows.length && rows[rows.length - 1].every(isEmpty)) rows.pop();
  let lastCol = width - 1;
  while (lastCol >= 0 && rows.every((r) => isEmpty(r[lastCol]))) lastCol--;
  rows = rows.map((r) => r.slice(0, lastCol + 1));
  return { ...t, rows };
}

/** Split a line of text into cells on tabs, or on runs of 2+ spaces. */
export function splitLooseLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map(clean);
  return line.split(/ {2,}/).map(clean);
}

/** Build an "estimated" table from loose lines of text. */
export function tableFromLines(id: string, label: string, lines: string[], note: string): RawTable | null {
  const rows = lines.filter((l) => clean(l)).map((l) => splitLooseLine(l).map((text) => ({ text })));
  if (rows.length < 2 || rows.every((r) => r.length < 2)) return null;
  return finalizeTable({ id, label, rows, notes: [note], estimated: true });
}
