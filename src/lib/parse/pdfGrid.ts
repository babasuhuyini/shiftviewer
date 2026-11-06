import { parseDayNumber, weekdaysForToken } from '../dates';
import type { RawCell, RawTable } from '../types';
import { clean, finalizeTable } from './util';

/**
 * Rebuilds a roster grid from positioned PDF text.
 *
 * PDF text has no table structure, and reading it in order silently drops empty cells
 * (which would shift every following day). Instead, each piece of text is placed into
 * a column by its x-position, using the row of day numbers (1, 2, 3 …) as column guides.
 */

export interface PdfItem {
  str: string;
  /** Left edge. */
  x: number;
  /** Baseline, measured from the TOP of the page. */
  y: number;
  w: number;
  h: number;
  bold?: boolean;
}

interface Token {
  text: string;
  x0: number;
  x1: number;
  cx: number;
  y: number;
  h: number;
  bold?: boolean;
}

interface Line {
  y: number;
  h: number;
  tokens: Token[];
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export function tokenize(items: PdfItem[]): Token[] {
  const out: Token[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const len = it.str.length;
    const cw = it.w > 0 ? it.w / len : Math.max(1, it.h * 0.5);
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(it.str))) {
      const x0 = it.x + m.index * cw;
      const x1 = x0 + m[0].length * cw;
      out.push({ text: m[0], x0, x1, cx: (x0 + x1) / 2, y: it.y, h: it.h || 8, bold: it.bold });
    }
  }
  return out;
}

export function groupLines(tokens: Token[]): Line[] {
  if (!tokens.length) return [];
  const sorted = [...tokens].sort((a, b) => a.y - b.y || a.x0 - b.x0);
  const tol = Math.max(1.5, median(sorted.map((t) => t.h)) * 0.45);
  const lines: Line[] = [];
  for (const t of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(t.y - last.y) <= tol) {
      last.tokens.push(t);
      last.y = (last.y * (last.tokens.length - 1) + t.y) / last.tokens.length;
      last.h = Math.max(last.h, t.h);
    } else {
      lines.push({ y: t.y, h: t.h, tokens: [t] });
    }
  }
  for (const l of lines) l.tokens.sort((a, b) => a.x0 - b.x0);
  return lines;
}

/** Longest run of day numbers increasing by one (allowing a month wrap like 30 → 1). */
function dayRun(line: Line): Token[] {
  let best: Token[] = [];
  let cur: Token[] = [];
  let prev: number | null = null;
  for (const t of line.tokens) {
    const n = /^\d{1,2}$/.test(t.text) ? parseDayNumber(t.text) : null;
    if (n !== null && (prev === null || n === prev + 1 || (n === 1 && prev >= 28))) {
      cur.push(t);
      prev = n;
    } else {
      if (cur.length > best.length) best = cur;
      cur = n !== null ? [t] : [];
      prev = n;
    }
  }
  if (cur.length > best.length) best = cur;
  return best;
}

const DETAIL_HEADER = /^(rank|grade|role|designation|category|cadre|position|title|dept|department|unit|ward|team)$/i;

export interface PageTableResult {
  table: RawTable | null;
  context: string[];
}

export function pageToTable(items: PdfItem[], pageIndex: number): PageTableResult {
  const lines = groupLines(tokenize(items));
  const context = lines.map((l) => clean(l.tokens.map((t) => t.text).join(' '))).filter(Boolean);
  if (!lines.length) return { table: null, context };

  // 1. Find the line of day numbers.
  let headerIdx = -1;
  let run: Token[] = [];
  lines.forEach((l, i) => {
    const r = dayRun(l);
    if (r.length > run.length) {
      run = r;
      headerIdx = i;
    }
  });
  if (run.length < 7) return { table: estimatedTable(lines, pageIndex), context };

  const centers = run.map((t) => t.cx);
  const gaps = centers.slice(1).map((c, i) => c - centers[i]);
  const spacing = median(gaps) || 10;
  const bounds = centers.map((c, i) => ({
    left: i === 0 ? c - spacing / 2 : (centers[i - 1] + c) / 2,
    right: i === centers.length - 1 ? c + spacing / 2 : (c + centers[i + 1]) / 2,
  }));
  const tableLeft = bounds[0].left;
  const tableRight = bounds[bounds.length - 1].right;
  const nDays = centers.length;

  // 2. Is there a second label column (e.g. RANK) left of the dates?
  let detailX: number | null = null;
  let nameHeader = 'Name';
  let detailHeader = '';
  for (let i = Math.max(0, headerIdx - 3); i <= headerIdx; i++) {
    for (const t of lines[i].tokens) {
      if (t.cx >= tableLeft) continue;
      if (DETAIL_HEADER.test(t.text)) {
        detailX = t.x0 - 1;
        detailHeader = t.text;
      } else if (/^(names?|staff|nurses?|employees?)$/i.test(t.text)) {
        nameHeader = t.text;
      }
    }
  }

  // Header text is often indented differently from the values below it, so line the
  // boundary up with where the values actually start (a common left edge near the header).
  if (detailX !== null) {
    const headerX = detailX + 1;
    const h = median(lines.map((l) => l.h)) || 10;
    const counts = new Map<number, number>();
    for (const l of lines.slice(headerIdx + 1)) {
      l.tokens.forEach((t, i) => {
        if (t.cx >= tableLeft || t.x0 < headerX - h * 1.5 || t.x0 > headerX + 2) return;
        // Must start a new cell: clearly separated from the previous word (not just a space inside a name).
        const prev = l.tokens[i - 1];
        if (prev && t.x0 - prev.x1 < h * 0.6) return;
        const k = Math.round(t.x0 * 2) / 2;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      });
    }
    const all = [...counts];
    const aligned = all.filter(([, n]) => n >= 2).map(([x]) => x);
    const pick = aligned.length ? aligned : all.map(([x]) => x);
    if (pick.length) detailX = Math.min(...pick) - 0.75;
  }

  const colOf = (cx: number) => {
    for (let i = 0; i < nDays; i++) if (cx >= bounds[i].left && cx < bounds[i].right) return i;
    return -1;
  };

  const labelCols = detailX === null ? 1 : 2;
  let multiValueCells = 0;
  let outside = 0;

  interface Built {
    y: number;
    h: number;
    label: Token[];
    detail: Token[];
    days: Token[][];
    spans: { from: number; to: number; text: string }[];
  }
  const build = (l: Line): Built => {
    const b: Built = { y: l.y, h: l.h, label: [], detail: [], days: Array.from({ length: nDays }, () => []), spans: [] };
    for (const t of l.tokens) {
      if (t.cx < tableLeft) {
        if (detailX !== null && t.x0 >= detailX) b.detail.push(t);
        else b.label.push(t);
        continue;
      }
      const c = colOf(t.cx);
      if (c < 0) {
        outside++;
        continue;
      }
      b.days[c].push(t);
      // Text much wider than a column (e.g. "ANNUAL LEAVE" across several days) covers those days too.
      if (t.x1 - t.x0 > spacing * 1.5) {
        const from = Math.max(0, colOf(Math.max(t.x0 + 1, tableLeft)));
        const to = colOf(Math.min(t.x1 - 1, tableRight - 0.01));
        if (from >= 0 && to > from) b.spans.push({ from, to: to < 0 ? nDays - 1 : to, text: t.text });
      }
    }
    return b;
  };

  // 3. Rows above the day numbers: keep only a weekday-letter row; the rest is title text.
  const rows: Built[] = [];
  for (let i = 0; i < headerIdx; i++) {
    const b = build(lines[i]);
    const filled = b.days.filter((d) => d.length);
    const weekdayLike = filled.filter((d) => d.length === 1 && weekdaysForToken(d[0].text)).length;
    if (filled.length >= nDays * 0.6 && weekdayLike >= filled.length * 0.8) rows.push(b);
  }
  rows.push(build(lines[headerIdx]));

  // 4. Rows below: stop at a large vertical gap (footnotes/legends below the table).
  const after = lines.slice(headerIdx + 1);
  const lineGaps = after.slice(1).map((l, i) => l.y - after[i].y);
  const typicalGap = median(lineGaps.filter((g) => g > 0)) || 12;
  let wrapped = 0;
  const body: Built[] = [];
  for (let i = 0; i < after.length; i++) {
    if (i > 0 && after[i].y - after[i - 1].y > typicalGap * 3) break;
    body.push(build(after[i]));
  }
  // Lines with only label text (a name wrapped onto two lines) join the nearest row with day values.
  const merged: Built[] = [];
  for (const b of body) {
    const hasDays = b.days.some((d) => d.length);
    if (!hasDays && (b.label.length || b.detail.length)) {
      const candidates = body.filter((o) => o !== b && o.days.some((d) => d.length));
      const nearest = candidates.sort((p, q) => Math.abs(p.y - b.y) - Math.abs(q.y - b.y))[0];
      if (nearest && Math.abs(nearest.y - b.y) <= Math.max(b.h, nearest.h) * 1.6) {
        if (b.y < nearest.y) {
          nearest.label.unshift(...b.label);
          nearest.detail.unshift(...b.detail);
        } else {
          nearest.label.push(...b.label);
          nearest.detail.push(...b.detail);
        }
        wrapped++;
        continue;
      }
    }
    merged.push(b);
  }
  rows.push(...merged);

  // 5. Emit cells.
  const toCells = (b: Built, isFirstRow: boolean): RawCell[] => {
    const joinTokens = (ts: Token[]): RawCell => ({
      text: clean(ts.map((t) => t.text).join(' ')),
      bold: ts.length > 0 && ts.every((t) => t.bold) ? true : undefined,
    });
    const cells: RawCell[] = [joinTokens(b.label)];
    if (labelCols === 2) cells.push(joinTokens(b.detail));
    if (isFirstRow && !cells[0].text) cells[0].text = '';
    b.days.forEach((ts) => {
      if (ts.length > 1) multiValueCells++;
      cells.push(joinTokens(ts));
    });
    for (const s of b.spans) {
      for (let c = s.from; c <= s.to; c++) {
        const cell = cells[labelCols + c];
        if (!cell.text) cell.mergedFrom = s.text;
      }
    }
    return cells;
  };
  const outRows = rows.map((b, i) => toCells(b, i === 0));
  // If the weekday row didn't carry the column titles, add them so the user can see what's what.
  if (!outRows.some((r) => /^(names?|staff|nurses?|employees?)$/i.test(r[0].text))) {
    const head: RawCell[] = [{ text: nameHeader }];
    if (labelCols === 2) head.push({ text: detailHeader });
    outRows.unshift([...head, ...Array.from({ length: nDays }, () => ({ text: '' }))]);
  }

  const notes = ['Columns were rebuilt from the position of text on the page. Compare a few rows with the original.'];
  if (wrapped) notes.push(`${wrapped} name${wrapped === 1 ? ' was' : 's were'} split over two lines and joined — check those names.`);
  if (multiValueCells) notes.push(`${multiValueCells} cell${multiValueCells === 1 ? '' : 's'} contained more than one value.`);
  if (outside) notes.push(`${outside} piece${outside === 1 ? '' : 's'} of text to the right of the last day column ${outside === 1 ? 'was' : 'were'} ignored.`);

  return {
    table: finalizeTable({ id: `page-${pageIndex}`, label: `Page ${pageIndex + 1}`, rows: outRows, notes }),
    context,
  };
}

/** No day-number row found: split each line into cells at large horizontal gaps. */
function estimatedTable(lines: Line[], pageIndex: number): RawTable | null {
  const rows: RawCell[][] = lines.map((l) => {
    const cells: RawCell[] = [];
    let cur: Token[] = [];
    for (const t of l.tokens) {
      const prev = cur[cur.length - 1];
      if (prev && t.x0 - prev.x1 > Math.max(4, l.h * 0.9)) {
        cells.push({ text: clean(cur.map((x) => x.text).join(' ')) });
        cur = [];
      }
      cur.push(t);
    }
    if (cur.length) cells.push({ text: clean(cur.map((x) => x.text).join(' ')) });
    return cells;
  });
  if (rows.filter((r) => r.length >= 2).length < 2) return null;
  return finalizeTable({
    id: `page-${pageIndex}`,
    label: `Page ${pageIndex + 1} (estimated columns)`,
    rows,
    notes: ['No row of day numbers was found, so columns were estimated from spacing. These columns may not line up with the original — check carefully.'],
    estimated: true,
  });
}
