import {
  daysInMonth,
  detectDateOrder,
  findMonthYear,
  formatMonthYear,
  parseDateText,
  parseDayNumber,
  toISO,
  weekdayOf,
  weekdaysForToken,
  MONTHS,
} from '../dates';
import type { DateColumn, GridMapping, ISODate, ListMapping, Period, RawCell, RawTable } from '../types';

const NAME_HEADER = /^(full\s*)?(names?|staff(\s*name)?|nurses?|employees?|personnel|officers?)$/i;
const DETAIL_HEADER = /^(rank|grade|role|designation|category|cadre|position|title|dept|department|unit|ward|team|staff\s*id|id|no\.?)$/i;
const IGNORE_COL_HEADER = /^(total|totals|hours|hrs|count|sum|no\.? of|s\/?n|#)$/i;

export const colLetter = (c: number): string => {
  let s = '';
  let n = c + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const textAt = (t: RawTable, r: number, c: number) => t.rows[r]?.[c]?.text ?? '';

function dateLikeHeader(cell: RawCell): { day: number | null; iso?: ISODate } | null {
  if (cell.dateISO) return { day: Number(cell.dateISO.slice(8, 10)), iso: cell.dateISO };
  const day = parseDayNumber(cell.text);
  if (day !== null) return { day };
  const iso = parseDateText(cell.text, 'DMY');
  if (iso) return { day: Number(iso.slice(8, 10)), iso };
  return null;
}

/** Score a row as a date header: the longest run of date-like cells in increasing day order. */
function headerCandidate(t: RawTable, r: number): DateColumn[] {
  const row = t.rows[r];
  let best: DateColumn[] = [];
  let cur: DateColumn[] = [];
  let prev: number | null = null;
  row.forEach((cell, c) => {
    const d = dateLikeHeader(cell);
    if (!d) {
      if (!cell.text && !cell.mergedFrom) return; // allow blank spacer cells
      if (cur.length > best.length) best = cur;
      cur = [];
      prev = null;
      return;
    }
    const day = d.day ?? 0;
    if (prev === null || day === prev + 1 || (day === 1 && prev >= 28)) {
      cur.push({ col: c, day: d.day, iso: d.iso, text: cell.text });
    } else {
      if (cur.length > best.length) best = cur;
      cur = [{ col: c, day: d.day, iso: d.iso, text: cell.text }];
    }
    prev = day;
  });
  if (cur.length > best.length) best = cur;
  return best;
}

function isNumeric(s: string) {
  return /^-?\d+(\.\d+)?$/.test(s.trim());
}

export interface GridDetection {
  mapping: GridMapping;
  period: Period;
  /** Weekday row check result for the suggested period. */
  confidence: 'high' | 'medium' | 'low';
}

export function detectGrid(t: RawTable, contextText: string[], fileName: string, forceHeaderRow?: number): GridDetection | null {
  const scanRows = Math.min(t.rows.length, 25);
  let headerRow = -1;
  let dateCols: DateColumn[] = [];
  if (forceHeaderRow !== undefined) {
    headerRow = forceHeaderRow;
    dateCols = headerCandidate(t, forceHeaderRow);
    if (!dateCols.length) return null;
  } else {
    for (let r = 0; r < scanRows; r++) {
      const cand = headerCandidate(t, r);
      if (cand.length > dateCols.length) {
        dateCols = cand;
        headerRow = r;
      }
    }
    if (dateCols.length < 5) return null;
  }

  const dateColSet = new Set(dateCols.map((d) => d.col));
  const width = t.rows[0]?.length ?? 0;

  // Weekday letter row next to the header.
  let weekdayRow: number | null = null;
  for (const r of [headerRow - 1, headerRow + 1, headerRow - 2]) {
    if (r < 0 || r >= t.rows.length) continue;
    const hits = dateCols.filter((d) => weekdaysForToken(textAt(t, r, d.col))).length;
    if (hits >= dateCols.length * 0.6) {
      weekdayRow = r;
      break;
    }
  }

  const firstData = Math.max(headerRow, weekdayRow ?? -1) + 1;
  const dataRows = t.rows.slice(firstData);

  // Name column: by header label, else the column with the most name-like text.
  const labelRows = [headerRow, weekdayRow].filter((r): r is number => r !== null);
  let nameCol = -1;
  for (let c = 0; c < width; c++) {
    if (dateColSet.has(c)) continue;
    if (labelRows.some((r) => NAME_HEADER.test(textAt(t, r, c)))) {
      nameCol = c;
      break;
    }
  }
  if (nameCol < 0) {
    let bestScore = 0;
    for (let c = 0; c < width; c++) {
      if (dateColSet.has(c)) continue;
      const score = dataRows.filter((row) => /[A-Za-z]{2,}.*\s.*[A-Za-z]{2,}/.test(row[c]?.text ?? '')).length;
      if (score > bestScore) {
        bestScore = score;
        nameCol = c;
      }
    }
  }
  if (nameCol < 0) nameCol = 0;

  // Detail columns (rank, unit…): other non-date columns with text, excluding totals.
  const detailCols: number[] = [];
  for (let c = 0; c < width; c++) {
    if (c === nameCol || dateColSet.has(c)) continue;
    const header = labelRows.map((r) => textAt(t, r, c)).find(Boolean) ?? '';
    if (IGNORE_COL_HEADER.test(header)) continue;
    const values = dataRows.map((row) => row[c]?.text ?? '').filter(Boolean);
    if (!values.length) continue;
    if (values.every(isNumeric) && !DETAIL_HEADER.test(header)) continue;
    detailCols.push(c);
  }

  const excludedRows = proposeExclusions(t, { headerRow, weekdayRow, nameCol, dateCols });
  const period = suggestPeriod(dateCols, contextText, fileName, t);
  const mapping: GridMapping = {
    kind: 'grid',
    headerRow,
    weekdayRow,
    nameCol,
    detailCols,
    dateCols,
    excludedRows,
    includedOverrides: [],
  };
  const check = weekdayCheck(t, mapping, period);
  const confidence = period.source === 'none' ? 'low' : check && check.mismatches === 0 && check.checked > 0 ? 'high' : 'medium';
  return { mapping, period, confidence };
}

/** Rows to skip: repeated headers, totals/summary rows, unnamed rows. */
export function proposeExclusions(
  t: RawTable,
  m: Pick<GridMapping, 'headerRow' | 'weekdayRow' | 'nameCol' | 'dateCols'>,
): { row: number; reason: string }[] {
  const out: { row: number; reason: string }[] = [];
  const first = Math.max(m.headerRow, m.weekdayRow ?? -1) + 1;
  const headerDays = m.dateCols.map((d) => textAt(t, m.headerRow, d.col));
  let inSummary = false;
  for (let r = first; r < t.rows.length; r++) {
    const name = textAt(t, r, m.nameCol);
    const vals = m.dateCols.map((d) => textAt(t, r, d.col));
    const filled = vals.filter(Boolean);
    const repeatsHeader = filled.length >= 5 && vals.filter((v, i) => v && v === headerDays[i]).length >= filled.length * 0.8;
    const weekdayRepeat = filled.length >= 5 && filled.filter((v) => weekdaysForToken(v)).length >= filled.length * 0.9 && filled.every((v) => v.length <= 3);
    const mostlyNumbers = filled.length >= 3 && filled.filter(isNumeric).length >= filled.length * 0.6;

    if (repeatsHeader) {
      out.push({ row: r, reason: 'Repeated date header' });
      inSummary = true; // a header repeated below the staff usually starts a totals block
      continue;
    }
    if (weekdayRepeat && NAME_HEADER.test(name)) {
      out.push({ row: r, reason: 'Repeated header' });
      continue;
    }
    if (NAME_HEADER.test(name) && !filled.length) {
      out.push({ row: r, reason: 'Repeated header' });
      continue;
    }
    if (mostlyNumbers) {
      out.push({ row: r, reason: 'Totals or summary row (numbers only)' });
      inSummary = true;
      continue;
    }
    if (inSummary && /^(total|totals|summary|morning|afternoon|evening|night|day|shifts?|n\/a)$/i.test(name)) {
      out.push({ row: r, reason: 'Summary row' });
      continue;
    }
    if (!name && filled.length) {
      out.push({ row: r, reason: 'Row has values but no name' });
      continue;
    }
  }
  return out;
}

/** Month/year of the first date column: from real dates, then the title, then the file name. */
export function suggestPeriod(dateCols: DateColumn[], contextText: string[], fileName: string, t: RawTable): Period {
  const withIso = dateCols.find((d) => d.iso);
  if (withIso) {
    const first = dateCols[0].iso ?? withIso.iso!;
    return { year: Number(first.slice(0, 4)), month: Number(first.slice(5, 7)), source: 'cells', evidence: first };
  }
  // Text in the rows above the header often holds the title.
  const topText = t.rows.slice(0, 3).flatMap((r) => r.map((c) => c.text)).filter(Boolean);
  const sources: { text: string; source: Period['source'] }[] = [
    ...contextText.map((text) => ({ text, source: 'document' as const })),
    ...topText.map((text) => ({ text, source: 'document' as const })),
    { text: fileName.replace(/\.[a-z0-9]+$/i, ''), source: 'filename' },
  ];
  for (const s of sources) {
    const found = findMonthYear(s.text);
    if (found && found.year) {
      let { month, year } = found;
      // Header like 26 27 … 31 1 2 … with a title naming the later month: the first column is the month before.
      const firstDay = dateCols[0].day ?? 1;
      const wraps = dateCols.some((d, i) => i > 0 && (d.day ?? 0) < (dateCols[i - 1].day ?? 0));
      if (wraps && firstDay > 15) {
        month -= 1;
        if (month < 1) { month = 12; year -= 1; }
      }
      return { year, month, source: s.source, evidence: found.evidence };
    }
  }
  return { year: new Date().getFullYear(), month: new Date().getMonth() + 1, source: 'none' };
}

/** Assign full dates to grid columns, rolling into the next month when day numbers wrap. */
export function resolveDates(dateCols: DateColumn[], period: Pick<Period, 'year' | 'month'>): { col: number; date: ISODate | null }[] {
  let { year, month } = period;
  let prev = 0;
  return dateCols.map((d) => {
    if (d.iso) return { col: d.col, date: d.iso };
    const day = d.day ?? 0;
    if (day < prev) {
      month++;
      if (month > 12) { month = 1; year++; }
    }
    prev = day;
    if (day < 1 || day > daysInMonth(year, month)) return { col: d.col, date: null };
    return { col: d.col, date: toISO(year, month, day) };
  });
}

/** Compare a weekday-letter row with the weekdays of the chosen month. */
export function weekdayCheck(
  t: RawTable,
  m: GridMapping,
  period: Pick<Period, 'year' | 'month'>,
): { checked: number; mismatches: number } | null {
  if (m.weekdayRow === null) return null;
  const dates = resolveDates(m.dateCols, period);
  let checked = 0;
  let mismatches = 0;
  dates.forEach(({ col, date }) => {
    const options = weekdaysForToken(textAt(t, m.weekdayRow!, col));
    if (!options || !date) return;
    checked++;
    if (!options.includes(weekdayOf(date))) mismatches++;
  });
  return { checked, mismatches };
}

/** Find months whose weekdays match the weekday row (used to suggest a fix). */
export function monthsMatchingWeekdays(t: RawTable, m: GridMapping, aroundYear: number): string[] {
  const out: string[] = [];
  for (let y = aroundYear - 1; y <= aroundYear + 1; y++) {
    for (let mo = 1; mo <= 12; mo++) {
      const c = weekdayCheck(t, m, { year: y, month: mo });
      if (c && c.checked >= 7 && c.mismatches === 0) out.push(formatMonthYear(y, mo));
    }
  }
  return out;
}

// ───────────────────────── List layout (one row per shift) ─────────────────────────

export function detectList(t: RawTable): ListMapping | null {
  const width = t.rows[0]?.length ?? 0;
  if (width < 2 || t.rows.length < 2) return null;
  const header = t.rows[0].map((c) => c.text.toLowerCase());
  const hasHeader = header.some((h) => /name|date|shift|start|end|staff/.test(h));
  const body = t.rows.slice(hasHeader ? 1 : 0);

  const find = (re: RegExp) => header.findIndex((h) => re.test(h));
  let dateCol = hasHeader ? find(/^date|day$|^shift date/) : -1;
  if (dateCol < 0) {
    // Column where most values are full dates.
    let best = 0;
    for (let c = 0; c < width; c++) {
      const vals = body.map((r) => r[c]);
      const hits = vals.filter((v) => v?.dateISO || parseDateText(v?.text ?? '', 'DMY') || parseDateText(v?.text ?? '', 'MDY')).length;
      if (hits > best && hits >= body.length * 0.6) {
        best = hits;
        dateCol = c;
      }
    }
  }
  if (dateCol < 0) return null;
  let nameCol = hasHeader ? find(/name|staff|nurse|employee/) : -1;
  if (nameCol < 0) nameCol = dateCol === 0 ? 1 : 0;
  let shiftCol = hasHeader ? find(/shift|duty|code|type/) : -1;
  if (shiftCol < 0 || shiftCol === dateCol) shiftCol = [0, 1, 2, 3].find((c) => c !== dateCol && c !== nameCol && c < width) ?? -1;
  if (shiftCol < 0) return null;
  const startCol = hasHeader ? find(/start|from|begin/) : -1;
  const endCol = hasHeader ? find(/end|to|finish/) : -1;
  const used = new Set([dateCol, nameCol, shiftCol, startCol, endCol]);
  const detailCols = hasHeader ? header.map((h, i) => (DETAIL_HEADER.test(h) && !used.has(i) ? i : -1)).filter((i) => i >= 0) : [];
  const order = detectDateOrder(body.map((r) => r[dateCol]?.text ?? ''));
  return {
    kind: 'list',
    headerRow: hasHeader ? 0 : -1,
    nameCol,
    dateCol,
    shiftCol,
    startCol: startCol >= 0 ? startCol : null,
    endCol: endCol >= 0 ? endCol : null,
    detailCols,
    dateOrder: order.order,
    dateOrderAmbiguous: order.ambiguous,
  };
}

export function describeColumn(t: RawTable, c: number, headerRows: number[]): string {
  const label = headerRows.map((r) => textAt(t, r, c)).find(Boolean);
  return label ? `Column ${colLetter(c)} — ${label}` : `Column ${colLetter(c)}`;
}

export function periodLabel(p: Pick<Period, 'year' | 'month'>): string {
  return `${MONTHS[p.month - 1]} ${p.year}`;
}
