import { formatMonthYear, parseDateText } from '../dates';
import type { Detail, Draft, DraftEntry, DraftPerson, GridMapping, ISODate, Issue, ListMapping, Period, RawTable } from '../types';
import { colLetter, resolveDates } from './layout';

const textAt = (t: RawTable, r: number, c: number) => t.rows[r]?.[c]?.text ?? '';
export const normName = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

function headerLabel(t: RawTable, rows: number[], c: number): string {
  return rows.map((r) => (r >= 0 ? textAt(t, r, c) : '')).find(Boolean) || `Column ${colLetter(c)}`;
}

export function buildDraft(t: RawTable, mapping: GridMapping | ListMapping, period: Pick<Period, 'year' | 'month'>): Draft {
  return mapping.kind === 'grid' ? buildGrid(t, mapping, period) : buildList(t, mapping);
}

function buildGrid(t: RawTable, m: GridMapping, period: Pick<Period, 'year' | 'month'>): Draft {
  const issues: Issue[] = [];
  const resolved = resolveDates(m.dateCols, period);
  const valid: { col: number; date: ISODate; seq: number }[] = [];
  const seen = new Map<ISODate, number>();
  resolved.forEach(({ col, date }, seq) => {
    if (!date) {
      issues.push({
        level: 'error',
        message: `Column ${colLetter(col)} (“${m.dateCols[seq].text}”) isn’t a real date in ${formatMonthYear(period.year, period.month)}. Check the month and year.`,
      });
      return;
    }
    if (seen.has(date)) {
      issues.push({ level: 'error', message: `Columns ${colLetter(seen.get(date)!)} and ${colLetter(col)} both resolve to ${date}.` });
      return;
    }
    seen.set(date, col);
    valid.push({ col, date, seq });
  });

  const labelRows = [m.headerRow, m.weekdayRow ?? -1];
  const included = new Set(m.includedOverrides);
  const excluded = new Map(m.excludedRows.filter((e) => !included.has(e.row)).map((e) => [e.row, e.reason]));
  const first = Math.max(m.headerRow, m.weekdayRow ?? -1) + 1;

  const people: DraftPerson[] = [];
  const summaryRows: Draft['summaryRows'] = [];
  const rowSignatures = new Map<string, number>();

  for (let r = first; r < t.rows.length; r++) {
    const reason = excluded.get(r);
    if (reason) {
      if (/summary|totals/i.test(reason)) {
        summaryRows.push({
          label: textAt(t, r, m.nameCol),
          values: new Map(valid.map((v) => [v.date, textAt(t, r, v.col)])),
        });
      }
      continue;
    }
    const name = textAt(t, r, m.nameCol) || (included.has(r) ? `(no name, row ${r + 1})` : '');
    const entries: DraftEntry[] = valid.map(({ col, date, seq }) => {
      const cell = t.rows[r][col] ?? { text: '' };
      if (!cell.text && cell.mergedFrom) return { date, raw: cell.mergedFrom, merged: true, seq };
      return { date, raw: cell.text, bold: cell.bold, seq };
    });
    if (!name && entries.every((e) => !e.raw)) continue; // empty spacer row

    const details: Detail[] = m.detailCols
      .map((c) => ({ label: headerLabel(t, labelRows, c), value: textAt(t, r, c) }))
      .filter((d) => d.value);

    // Exact copies of an earlier row (copy-paste) would double-count the same person.
    const signature = [normName(name), ...details.map((d) => d.value), ...entries.map((e) => e.raw)].join('\u0001');
    if (rowSignatures.has(signature)) {
      issues.push({
        level: 'warning',
        message: `Row ${r + 1} is an exact copy of row ${rowSignatures.get(signature)! + 1} and was skipped.`,
      });
      continue;
    }
    rowSignatures.set(signature, r);
    people.push({ key: `r${r}`, row: r + 1, name, details, entries });
  }

  addDuplicateNameIssues(people, issues);
  const mergedCount = people.reduce((n, p) => n + p.entries.filter((e) => e.merged).length, 0);
  if (mergedCount) {
    issues.push({ level: 'warning', message: `${mergedCount} day${mergedCount === 1 ? '' : 's'} take their value from a merged cell. Check a few of them against the original.` });
  }
  if (!people.length) issues.push({ level: 'error', message: 'No staff rows were found. Check the names column and the header row.' });

  return { layout: 'grid', dates: valid.map((v) => v.date), people, issues, summaryRows };
}

function buildList(t: RawTable, m: ListMapping): Draft {
  const issues: Issue[] = [];
  const labelRows = [m.headerRow];
  const byKey = new Map<string, DraftPerson>();
  const badDates: number[] = [];
  const dates = new Set<ISODate>();
  const start = m.headerRow + 1;

  for (let r = start; r < t.rows.length; r++) {
    const row = t.rows[r];
    const name = textAt(t, r, m.nameCol);
    const dateCell = row[m.dateCol];
    const raw = textAt(t, r, m.shiftCol);
    if (!name && !dateCell?.text && !raw) continue;
    const date = dateCell?.dateISO ?? parseDateText(dateCell?.text ?? '', m.dateOrder);
    if (!date) {
      badDates.push(r + 1);
      continue;
    }
    if (!name) {
      issues.push({ level: 'warning', message: `Row ${r + 1} has a date but no name and was skipped.` });
      continue;
    }
    const details: Detail[] = m.detailCols
      .map((c) => ({ label: headerLabel(t, labelRows, c), value: textAt(t, r, c) }))
      .filter((d) => d.value);
    const key = `n:${normName(name)}|${details.map((d) => d.value.toLowerCase()).join('|')}`;
    let p = byKey.get(key);
    if (!p) {
      p = { key, row: r + 1, name, details, entries: [] };
      byKey.set(key, p);
    }
    const entry: DraftEntry = {
      date,
      raw,
      seq: -1,
      startText: m.startCol !== null ? textAt(t, r, m.startCol) : undefined,
      endText: m.endCol !== null ? textAt(t, r, m.endCol) : undefined,
    };
    // Same person, date and shift listed twice → keep once.
    if (p.entries.some((e) => e.date === date && e.raw === raw && e.startText === entry.startText)) {
      issues.push({ level: 'info', message: `Row ${r + 1} repeats an earlier entry for the same person, date and shift; it was counted once.` });
      continue;
    }
    p.entries.push(entry);
    dates.add(date);
  }
  if (badDates.length) {
    issues.push({
      level: 'warning',
      message: `${badDates.length} row${badDates.length === 1 ? '' : 's'} had a date that couldn’t be read (row ${badDates.slice(0, 6).join(', ')}${badDates.length > 6 ? '…' : ''}). They are not included.`,
    });
  }
  if (m.dateOrderAmbiguous) {
    issues.push({
      level: 'warning',
      message: `Dates like 03/04 could be day-first or month-first. You chose ${m.dateOrder === 'MDY' ? 'month first (US style)' : 'day first'} — check a few dates.`,
    });
  }
  const people = [...byKey.values()];
  for (const p of people) p.entries.sort((a, b) => a.date.localeCompare(b.date));
  addDuplicateNameIssues(people, issues);
  if (!people.length) issues.push({ level: 'error', message: 'No shifts were found. Check the column choices.' });
  return { layout: 'list', dates: [...dates].sort(), people, issues, summaryRows: [] };
}

function addDuplicateNameIssues(people: DraftPerson[], issues: Issue[]) {
  const counts = new Map<string, DraftPerson[]>();
  for (const p of people) {
    const k = normName(p.name);
    counts.set(k, [...(counts.get(k) ?? []), p]);
  }
  for (const group of counts.values()) {
    if (group.length > 1) {
      issues.push({
        level: 'warning',
        message: `The same name appears on ${group.length} rows (${group.map((p) => `row ${p.row}`).join(', ')}). They are kept separate; details and row numbers are shown when choosing a name.`,
      });
    }
  }
}
