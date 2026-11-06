import type { DateOrder, ISODate } from './types';

/*
 * All date maths uses plain Y/M/D numbers and UTC-based Date objects only for
 * arithmetic, so a roster date can never move because of the device's time zone.
 */

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = WEEKDAYS.map((d) => d.slice(0, 3));

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(y: number, m: number, d: number): ISODate {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseISO(s: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidYMD(y: number, m: number, d: number): boolean {
  return y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(s: ISODate): number {
  const { y, m, d } = parseISO(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(s: ISODate, n: number): ISODate {
  const { y, m, d } = parseISO(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function diffDays(from: ISODate, to: ISODate): number {
  const a = parseISO(from);
  const b = parseISO(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Today's date on this device's own calendar. */
export function todayISO(): ISODate {
  const n = new Date();
  return toISO(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/** Local calendar date of a timestamp (e.g. when the roster was imported). */
export function localDateOf(timestamp: string): ISODate {
  const n = new Date(timestamp);
  return toISO(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export function formatLong(s: ISODate): string {
  const { y, m, d } = parseISO(s);
  return `${WEEKDAYS[weekdayOf(s)]} ${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatMedium(s: ISODate): string {
  const { m, d } = parseISO(s);
  return `${WEEKDAYS_SHORT[weekdayOf(s)]} ${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatDayMonth(s: ISODate): string {
  const { m, d } = parseISO(s);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatMonthYear(y: number, m: number): string {
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatRange(a: ISODate, b: ISODate): string {
  if (a === b) return formatDayMonth(a);
  const pa = parseISO(a);
  const pb = parseISO(b);
  if (pa.y === pb.y && pa.m === pb.m) return `${pa.d}–${pb.d} ${MONTHS_SHORT[pa.m - 1]}`;
  return `${formatDayMonth(a)} – ${formatDayMonth(b)}`;
}

export function relativeLabel(date: ISODate, today: ISODate): string {
  const n = diffDays(today, date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return `In ${n} days`;
  if (n >= 7 && n < 14) return 'Next week';
  if (n >= 14) return `In ${Math.round(n / 7)} weeks`;
  return `${-n} days ago`;
}

/** Weeks of a month; null for padding cells. weekStart 0 = Sunday. */
export function monthMatrix(y: number, m: number, weekStart = 0): (ISODate | null)[][] {
  const first = toISO(y, m, 1);
  const lead = (weekdayOf(first) - weekStart + 7) % 7;
  const total = daysInMonth(y, m);
  const cells: (ISODate | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= total; d++) cells.push(toISO(y, m, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Months (y, m) touched by a date range, in order. */
export function monthsBetween(start: ISODate, end: ISODate): { y: number; m: number }[] {
  const out: { y: number; m: number }[] = [];
  let { y, m } = parseISO(start);
  const e = parseISO(end);
  while (y < e.y || (y === e.y && m <= e.m)) {
    out.push({ y, m });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

// ───────────────────────── Parsing dates from text ─────────────────────────

const MONTH_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;

export function monthFromName(s: string): number | null {
  const m = MONTH_RE.exec(s.trim());
  if (!m || m.index !== 0 || m[0].length !== s.trim().replace(/\.$/, '').length) return null;
  return MONTHS.findIndex((name) => name.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3))) + 1 || null;
}

/** Find a month (and year if present) mentioned in free text such as a title or file name. */
export function findMonthYear(text: string): { month: number; year: number | null; evidence: string } | null {
  // Treat separators like "_" or "-" as spaces so "MICU_November_2026" is found.
  const t = text.replace(/[_]+/g, ' ');
  const re = new RegExp(MONTH_RE.source + String.raw`[\s,.\-–—/]*('?\d{2}\b|\d{4}\b)?`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const month = MONTHS.findIndex((name) => name.toLowerCase().startsWith(m![1].toLowerCase().slice(0, 3))) + 1;
    // "may" is also an ordinary word — only accept it when followed by a year.
    if (m[1].toLowerCase() === 'may' && !m[2]) continue;
    let year: number | null = null;
    if (m[2]) {
      const raw = m[2].replace("'", '');
      year = raw.length === 2 ? 2000 + Number(raw) : Number(raw);
    } else {
      const y = /\b(19|20|21)\d{2}\b/.exec(t);
      if (y) year = Number(y[0]);
    }
    return { month, year, evidence: m[0].trim() };
  }
  return null;
}

const WEEKDAY_WORD = String.raw`(?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\.?`;

/** Day-of-month header like "7", "07", "7th", "Sun 7", "7 Sun". */
export function parseDayNumber(text: string): number | null {
  const re = new RegExp(String.raw`^(?:${WEEKDAY_WORD}\s*)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*${WEEKDAY_WORD})?$`, 'i');
  const m = re.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 31 ? n : null;
}

/** Possible weekdays (0–6) for a header token like "S", "Tu", "Thu", "Monday". */
export function weekdaysForToken(token: string): number[] | null {
  const t = token.trim().toLowerCase().replace(/\.$/, '');
  if (!t) return null;
  const single: Record<string, number[]> = { s: [0, 6], m: [1], t: [2, 4], w: [3], f: [5], h: [4], r: [4], u: [0] };
  if (t.length === 1) return single[t] ?? null;
  const two: Record<string, number[]> = { su: [0], mo: [1], tu: [2], we: [3], th: [4], fr: [5], sa: [6] };
  const k = t.slice(0, 2);
  if (!two[k]) return null;
  // Must be a prefix of the full weekday name.
  const full = WEEKDAYS[two[k][0]].toLowerCase();
  if (!full.startsWith(t) && !(t.startsWith('tues') && full === 'tuesday') && !(t.startsWith('thur') && full === 'thursday')) return null;
  return two[k];
}

function fullYear(y: string): number {
  const n = Number(y);
  return y.length <= 2 ? 2000 + n : n;
}

/**
 * Parse a full date written as text. Returns null if the text isn't a full date.
 * `order` decides between 03/11/2026 meaning 3 Nov (DMY) or 11 Mar (MDY).
 */
export function parseDateText(text: string, order: DateOrder, fallbackYear?: number): ISODate | null {
  let s = text.trim().replace(/\s+/g, ' ');
  s = s.replace(new RegExp(String.raw`^${WEEKDAY_WORD},?\s+`, 'i'), '');
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return isValidYMD(y, mo, d) ? toISO(y, mo, d) : null;
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = fullYear(m[3]);
    const [d, mo] = order === 'MDY' ? [b, a] : [a, b];
    return isValidYMD(y, mo, d) ? toISO(y, mo, d) : null;
  }
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s\-/]+([A-Za-z]{3,9})\.?(?:[\s\-/,]+(\d{2}|\d{4}))?$/.exec(s);
  if (m) {
    const mo = monthFromName(m[2]);
    const y = m[3] ? fullYear(m[3]) : fallbackYear;
    if (!mo || !y) return null;
    const d = Number(m[1]);
    return isValidYMD(y, mo, d) ? toISO(y, mo, d) : null;
  }
  m = /^([A-Za-z]{3,9})\.?[\s\-/]+(\d{1,2})(?:st|nd|rd|th)?,?(?:[\s\-/]+(\d{4}))?$/.exec(s);
  if (m) {
    const mo = monthFromName(m[1]);
    const y = m[3] ? Number(m[3]) : fallbackYear;
    if (!mo || !y) return null;
    const d = Number(m[2]);
    return isValidYMD(y, mo, d) ? toISO(y, mo, d) : null;
  }
  return null;
}

/** Decide DMY vs MDY from a set of numeric dates like 03/11/2026. */
export function detectDateOrder(values: string[]): { order: DateOrder; ambiguous: boolean } {
  let dmy = false;
  let mdy = false;
  let numericSlash = false;
  let iso = false;
  for (const v of values) {
    const s = v.trim();
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(s)) { iso = true; continue; }
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
    if (!m) continue;
    numericSlash = true;
    if (Number(m[1]) > 12) dmy = true;
    if (Number(m[2]) > 12) mdy = true;
  }
  if (dmy && !mdy) return { order: 'DMY', ambiguous: false };
  if (mdy && !dmy) return { order: 'MDY', ambiguous: false };
  if (!numericSlash) return { order: iso ? 'YMD' : 'DMY', ambiguous: false };
  return { order: 'DMY', ambiguous: true };
}

/** HH:MM from text like "7:30", "07.30", "7am", "1930", "7:30 pm". */
export function parseTimeText(text: string): string | undefined {
  const s = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return undefined;
  let m = /^(\d{1,2})(?:[:.h](\d{2}))?(am|pm)?$/.exec(s);
  if (!m) {
    const four = /^(\d{2})(\d{2})$/.exec(s);
    if (four) m = [s, four[1], four[2], undefined] as unknown as RegExpExecArray;
  }
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return undefined;
  return `${pad(h)}:${pad(min)}`;
}

export function formatTime(hhmm: string | undefined): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${pad(m)}${suffix}`;
}
