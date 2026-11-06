import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { addDays, findMonthYear, parseDateText, parseDayNumber, weekdayOf, detectDateOrder, parseTimeText } from '../src/lib/dates';
import { buildRoster } from '../src/lib/interpret/build';
import { collectCodes } from '../src/lib/interpret/codes';
import { buildDraft } from '../src/lib/interpret/draft';
import { detectGrid, detectList, weekdayCheck } from '../src/lib/interpret/layout';
import { detectLeave, leaveCells } from '../src/lib/interpret/leave';
import { readDocx } from '../src/lib/parse/docx';
import { pageToTable, type PdfItem } from '../src/lib/parse/pdfGrid';
import { findSelected } from '../src/lib/roster';
import type { Extraction, RawTable } from '../src/lib/types';

// ───────── helpers: synthetic roster shaped like the real sample (fake names) ─────────
const WD = 'SMTWTFS';
function nov2026Grid(rows: [string, string, string[]][]): RawTable {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const t = (s: string) => ({ text: s });
  return {
    id: 't',
    label: 'Table 1',
    notes: [],
    rows: [
      [t('NAME'), t('RANK'), ...days.map((d) => t(WD[(d - 1) % 7]))],
      [t(''), t(''), ...days.map((d) => t(String(d)))],
      ...rows.map(([n, r, cells]) => [t(n), t(r), ...days.map((_, i) => t(cells[i] ?? ''))]),
      [t('SHIFTS'), t('DATES'), ...days.map((d) => t(String(d)))],
      [t('MORNING'), t('N/A'), ...days.map(() => t('5'))],
      [t('NIGHT'), t('N/A'), ...days.map(() => t('4'))],
    ],
  };
}
const split = (s: string) => s.split(' ');
const leaveRow = 'A N N U A L _ _ L E A V E _ _ A N N U A L _ _ L E A V E _ _'.split(' ').map((c) => (c === '_' ? '' : c));

const SAMPLE = nov2026Grid([
  ['Test Person One', 'SN', split('X M M M M M X X M M M M M X X M M M M M X X M M M M M X X M')],
  ['Test Person Two', 'MO', split('N N N N X X X A A A M M X X A M A X X A M M X X M A A A M X')],
  ['Test Person Three', 'SM', ['', ...split('A A A M M X X N N N N X X X N N N N X X X N N N N X X X N')]],
  ['Test Person Four', 'NS', leaveRow],
  ['Test Person Five', 'MO', split('M A T E R N I T Y _ _ L E A V E _ _ M A T E R N I T Y _ _ L').map((c) => (c === '_' ? '' : c))],
]);
const ctx = ['TEST UNIT –NOVEMBER 2026 TIME TABLE'];

function interpret(table: RawTable, context = ctx) {
  const det = detectGrid(table, context, 'roster.docx')!;
  const draft = buildDraft(table, det.mapping, det.period);
  const { proposals, gaps } = detectLeave(draft);
  const leaveMap = leaveCells(proposals, gaps);
  const codes = collectCodes(draft, leaveMap);
  return { det, draft, proposals, gaps, leaveMap, codes };
}

// ─────────────────────────── dates ───────────────────────────
describe('dates', () => {
  it('knows 1 Nov 2026 is a Sunday and never shifts dates', () => {
    expect(weekdayOf('2026-11-01')).toBe(0);
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
  it('finds month/year in titles and file names', () => {
    expect(findMonthYear('MATERNAL INTENSIVE CARE UNIT –NOVEMBER 2026 TIME TABLE')).toMatchObject({ month: 11, year: 2026 });
    expect(findMonthYear('MICU November 2026_024852')).toMatchObject({ month: 11, year: 2026 });
    expect(findMonthYear('Rota_Sept_2026')).toMatchObject({ month: 9, year: 2026 });
    expect(findMonthYear('you may go')).toBeNull();
  });
  it('parses day headers and dates', () => {
    expect(parseDayNumber('7')).toBe(7);
    expect(parseDayNumber('Sun 1')).toBe(1);
    expect(parseDayNumber('32')).toBeNull();
    expect(parseDateText('03/11/2026', 'DMY')).toBe('2026-11-03');
    expect(parseDateText('03/11/2026', 'MDY')).toBe('2026-03-11');
    expect(parseDateText('2026-11-03', 'DMY')).toBe('2026-11-03');
    expect(parseDateText('3 Nov 2026', 'DMY')).toBe('2026-11-03');
    expect(parseDateText('Tue 3 Nov', 'DMY', 2026)).toBe('2026-11-03');
    expect(parseDateText('31/11/2026', 'DMY')).toBeNull();
    expect(detectDateOrder(['13/11/2026', '01/11/2026'])).toEqual({ order: 'DMY', ambiguous: false });
    expect(detectDateOrder(['01/02/2026']).ambiguous).toBe(true);
    expect(parseTimeText('7:30pm')).toBe('19:30');
    expect(parseTimeText('0700')).toBe('07:00');
  });
});

// ─────────────────────────── grid roster ───────────────────────────
describe('grid roster like the sample', () => {
  const { det, draft, proposals, gaps, codes } = interpret(SAMPLE);

  it('finds header, names, rank, period and confirms weekdays', () => {
    expect(det.mapping.headerRow).toBe(1);
    expect(det.mapping.weekdayRow).toBe(0);
    expect(det.mapping.nameCol).toBe(0);
    expect(det.mapping.detailCols).toEqual([1]);
    expect(det.period).toMatchObject({ year: 2026, month: 11, source: 'document' });
    expect(weekdayCheck(SAMPLE, det.mapping, det.period)).toEqual({ checked: 30, mismatches: 0 });
    expect(det.confidence).toBe('high');
  });

  it('skips the totals block and keeps every staff row once', () => {
    expect(draft.people.map((p) => p.name)).toEqual(['Test Person One', 'Test Person Two', 'Test Person Three', 'Test Person Four', 'Test Person Five']);
    expect(det.mapping.excludedRows.map((e) => e.row)).toEqual([7, 8, 9]);
    expect(draft.summaryRows.map((s) => s.label)).toEqual(['MORNING', 'NIGHT']);
  });

  it('keeps a blank first day in place (does not shift later days)', () => {
    const p3 = draft.people[2];
    expect(p3.entries[0]).toMatchObject({ date: '2026-11-01', raw: '' });
    expect(p3.entries[1]).toMatchObject({ date: '2026-11-02', raw: 'A' });
    expect(p3.entries[29]).toMatchObject({ date: '2026-11-30', raw: 'N' });
  });

  it('detects leave spelled across cells, including a cut-off word', () => {
    const four = proposals.filter((p) => p.personKey === draft.people[3].key);
    expect(four.map((p) => [p.letters, p.label])).toEqual([
      ['ANNUAL', 'Annual leave'],
      ['LEAVE', 'Annual leave'],
      ['ANNUAL', 'Annual leave'],
      ['LEAVE', 'Annual leave'],
    ]);
    const five = proposals.filter((p) => p.personKey === draft.people[4].key);
    expect(five.map((p) => p.letters)).toEqual(['MATERNITY', 'LEAVE', 'MATERNITY', 'L']);
    expect(five[3].partial).toBe(true);
    expect(five.every((p) => p.label === 'Maternity leave')).toBe(true);
    // No leave found in ordinary shift rows.
    expect(proposals.some((p) => [0, 1, 2].includes(draft.people.findIndex((x) => x.key === p.personKey)))).toBe(false);
    expect(gaps.filter((g) => g.personKey === draft.people[3].key)).toHaveLength(3);
  });

  it('leaves only real shift codes after leave words are removed', () => {
    expect(codes.codes.map((c) => c.key).sort()).toEqual(['A', 'M', 'N', 'X']);
  });

  it('blank cells are never days off unless confirmed; gaps stay unassigned by default', () => {
    const r = interpret(SAMPLE);
    const { roster, checks } = buildRoster({
      extraction: { format: 'docx', fileName: 'roster.docx', tables: [SAMPLE], contextText: ctx, warnings: [] },
      table: SAMPLE,
      draft: r.draft,
      leaveMap: r.leaveMap,
      blankMeaning: 'unassigned',
      codes: [
        { key: 'M', kind: 'shift', label: 'Morning' },
        { key: 'A', kind: 'shift', label: 'Afternoon' },
        { key: 'N', kind: 'shift', label: 'Night', overnight: true },
        { key: 'X', kind: 'off', label: 'Off' },
      ],
    });
    const four = roster.entries[r.draft.people[3].key];
    expect(four[0]).toMatchObject({ kind: 'leave', raw: 'A', label: 'Annual leave' });
    expect(four[6]).toMatchObject({ kind: 'unassigned', raw: '' });
    expect(roster.entries[r.draft.people[2].key][0]).toMatchObject({ kind: 'unassigned' });
    expect(roster.entries[r.draft.people[1].key][0]).toMatchObject({ kind: 'shift', label: 'Night', overnight: true });
    expect(checks.length).toBeGreaterThan(0);
    // Gap opt-in only applies when the user ticks it.
    const withGaps = leaveCells(r.proposals, r.gaps.map((g) => ({ ...g, asLeave: true })));
    expect(withGaps.get(r.draft.people[3].key)?.get(6)).toMatchObject({ via: 'leave-gap' });
  });

  it('rejecting a word means its letters are treated as codes again', () => {
    const r = interpret(SAMPLE);
    const rejected = r.proposals.map((p) => ({ ...p, accepted: false }));
    const codes = collectCodes(r.draft, leaveCells(rejected, r.gaps));
    expect(codes.codes.map((c) => c.key)).toContain('U');
  });

  it('flags the period as unknown when nothing names the month', () => {
    const det = detectGrid(SAMPLE, [], 'roster.docx')!;
    expect(det.period.source).toBe('none');
    expect(det.confidence).toBe('low');
  });

  it('skips exact duplicate rows and warns about repeated names', () => {
    const dup = nov2026Grid([
      ['Same Name', 'SN', split('M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M')],
      ['Same Name', 'SN', split('M M M M M M M M M M M M M M M M M M M M M M M M M M M M M M')],
      ['Same Name', 'MO', split('A A A A A A A A A A A A A A A A A A A A A A A A A A A A A A')],
    ]);
    const det = detectGrid(dup, ctx, 'x')!;
    const draft = buildDraft(dup, det.mapping, det.period);
    expect(draft.people).toHaveLength(2);
    expect(draft.issues.some((i) => /exact copy/.test(i.message))).toBe(true);
    expect(draft.issues.some((i) => /same name appears/.test(i.message))).toBe(true);
  });
});

// ─────────────────────────── nurse matching ───────────────────────────
describe('selected nurse matching', () => {
  it('only matches exactly one person; never guesses between duplicates', () => {
    const roster = {
      people: [
        { id: 'a', name: 'Ama Test', details: [{ label: 'RANK', value: 'SN' }], row: 3 },
        { id: 'b', name: 'Ama Test', details: [{ label: 'RANK', value: 'SN' }], row: 9 },
        { id: 'c', name: 'Kofi Test', details: [{ label: 'RANK', value: 'MO' }], row: 4 },
      ],
    } as never;
    expect(findSelected(roster, { name: 'kofi  test', details: [{ label: 'RANK', value: 'MO' }], row: 1 })?.id).toBe('c');
    expect(findSelected(roster, { name: 'Ama Test', details: [{ label: 'RANK', value: 'SN' }], row: 9 })?.id).toBe('b');
    expect(findSelected(roster, { name: 'Ama Test', details: [{ label: 'RANK', value: 'SN' }], row: 5 })).toBeNull();
    expect(findSelected(roster, { name: 'Kofi Test', details: [{ label: 'RANK', value: 'SN' }], row: 4 })).toBeNull();
  });
});

// ─────────────────────────── list layout ───────────────────────────
describe('list layout (one row per shift)', () => {
  it('reads name/date/shift/time columns', () => {
    const t = (s: string) => ({ text: s });
    const table: RawTable = {
      id: 'csv',
      label: 'CSV',
      notes: [],
      rows: [
        [t('Name'), t('Date'), t('Shift'), t('Start'), t('End')],
        [t('Test A'), t('13/11/2026'), t('Day'), t('07:00'), t('19:00')],
        [t('Test A'), t('14/11/2026'), t('Night'), t('19:00'), t('07:00')],
        [t('Test B'), t('13/11/2026'), t('Day'), t('07:00'), t('19:00')],
      ],
    };
    const m = detectList(table)!;
    expect(m).toMatchObject({ nameCol: 0, dateCol: 1, shiftCol: 2, startCol: 3, endCol: 4, dateOrder: 'DMY', dateOrderAmbiguous: false });
    const draft = buildDraft(table, m, { year: 2026, month: 11 });
    expect(draft.people).toHaveLength(2);
    expect(draft.dates).toEqual(['2026-11-13', '2026-11-14']);
    const ex: Extraction = { format: 'csv', fileName: 'x.csv', tables: [table], contextText: [], warnings: [] };
    const { roster } = buildRoster({
      extraction: ex,
      table,
      draft,
      leaveMap: new Map(),
      blankMeaning: 'unassigned',
      codes: [
        { key: 'DAY', kind: 'shift', label: 'Day' },
        { key: 'NIGHT', kind: 'shift', label: 'Night' },
      ],
    });
    expect(roster.entries[draft.people[0].key][1]).toMatchObject({ label: 'Night', start: '19:00', end: '07:00', overnight: true });
  });
});

// ─────────────────────────── Word reader ───────────────────────────
async function makeDocx(tableXml: string, header = 'TEST WARD – MARCH 2027 DUTY ROSTER'): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document ${W}><w:body>${tableXml}</w:body></w:document>`);
  zip.file('word/header1.xml', `<?xml version="1.0"?><w:hdr ${W}><w:p><w:r><w:t>${header}</w:t></w:r></w:p></w:hdr>`);
  return zip.generateAsync({ type: 'arraybuffer' });
}
const cell = (text: string, extra = '', bold = false) =>
  `<w:tc>${extra ? `<w:tcPr>${extra}</w:tcPr>` : ''}<w:p><w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;
const row = (cells: string[]) => `<w:tr>${cells.join('')}</w:tr>`;

describe('Word reader', () => {
  it('reads tables, header title, bold, merged and vertically merged cells', async () => {
    const xml = `<w:tbl>${[
      row([cell('NAME'), cell('1'), cell('2'), cell('3'), cell('4')]),
      row([cell('Test One'), cell('M'), cell('ANNUAL LEAVE', '<w:gridSpan w:val="2"/>', true), cell('N')]),
      row([cell('Test Two', '<w:vMerge w:val="restart"/>'), cell(''), cell('A'), cell('A'), cell('X')]),
      row([cell('', '<w:vMerge/>'), cell('M'), cell('M'), cell(''), cell('X')]),
    ].join('')}</w:tbl>`;
    const ex = await readDocx(await makeDocx(xml), 'r.docx');
    expect(ex.contextText[0]).toContain('MARCH 2027');
    const t = ex.tables[0];
    expect(t.rows[1].map((c) => c.text)).toEqual(['Test One', 'M', 'ANNUAL LEAVE', '', 'N']);
    expect(t.rows[1][2].bold).toBe(true);
    expect(t.rows[1][3].mergedFrom).toBe('ANNUAL LEAVE');
    expect(t.rows[3][0]).toMatchObject({ text: '', mergedFrom: 'Test Two' });
    expect(t.notes.some((n) => /merged/.test(n))).toBe(true);

    const det = detectGrid(t, ex.contextText, ex.fileName)!;
    expect(det).toBeNull(); // only 4 day columns — below the auto-detect threshold
  });

  it('auto-detects a full-month Word roster and its period from the page header', async () => {
    const days = Array.from({ length: 31 }, (_, i) => cell(String(i + 1)));
    const shifts = Array.from({ length: 31 }, (_, i) => cell(i % 2 ? 'M' : 'X'));
    const xml = `<w:tbl>${row([cell('NAME'), ...days])}${row([cell('Test Three'), ...shifts])}</w:tbl>`;
    const ex = await readDocx(await makeDocx(xml), 'r.docx');
    const det = detectGrid(ex.tables[0], ex.contextText, ex.fileName)!;
    expect(det.period).toMatchObject({ year: 2027, month: 3, source: 'document' });
    const draft = buildDraft(ex.tables[0], det.mapping, det.period);
    expect(draft.dates[30]).toBe('2027-03-31');
  });

  it('explains when a document has no table', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Just a letter.</w:t></w:r></w:p></w:body></w:document>`);
    await expect(readDocx(await zip.generateAsync({ type: 'arraybuffer' }), 'x.docx')).rejects.toMatchObject({ title: 'No roster table found' });
  });
});

// ─────────────────────────── PDF grid rebuild ───────────────────────────
describe('PDF grid rebuilding', () => {
  const colX = (d: number) => 200 + (d - 1) * 25; // left-aligned cells, 25pt apart
  function items(rowsSpec: { name: string; rank: string; cells: string[] }[]): PdfItem[] {
    const out: PdfItem[] = [{ str: 'TEST UNIT – NOVEMBER 2026 TIME TABLE', x: 300, y: 16, w: 300, h: 14 }];
    out.push({ str: 'NAME', x: 60, y: 48, w: 35, h: 12 }, { str: 'RANK', x: 152, y: 48, w: 34, h: 12 });
    for (let d = 1; d <= 30; d++) out.push({ str: WD[(d - 1) % 7], x: colX(d), y: 48, w: 7, h: 12 });
    for (let d = 1; d <= 30; d++) out.push({ str: String(d), x: colX(d), y: 66, w: d < 10 ? 6 : 12, h: 12 });
    rowsSpec.forEach((r, i) => {
      const y = 84 + i * 15;
      // Rank values start 2pt left of the RANK header, like the real sample.
      out.push({ str: r.name, x: 60, y, w: r.name.length * 5, h: 12 }, { str: r.rank, x: 150, y, w: 15, h: 12 });
      r.cells.forEach((c, d) => c && out.push({ str: c, x: colX(d + 1), y, w: 9, h: 12 }));
    });
    return out;
  }

  it('places values by position so a missing cell does not shift the row', () => {
    const cells = split('A A A M M X X N N N N X X X N N N N X X X N N N N X X X N N');
    cells[0] = '';
    const { table, context } = pageToTable(items([{ name: 'Test Pdf Person', rank: 'SM', cells }]), 0);
    expect(context[0]).toContain('NOVEMBER 2026');
    const det = detectGrid(table!, context, 'x.pdf')!;
    expect(det.mapping.detailCols).toEqual([1]);
    const draft = buildDraft(table!, det.mapping, det.period);
    expect(draft.people[0]).toMatchObject({ name: 'Test Pdf Person', details: [{ value: 'SM' }] });
    expect(draft.people[0].entries[0].raw).toBe('');
    expect(draft.people[0].entries[1]).toMatchObject({ date: '2026-11-02', raw: 'A' });
    expect(draft.people[0].entries[29].raw).toBe('N');
  });

  it('falls back to estimated columns (and says so) when there is no day row', () => {
    const { table } = pageToTable(
      [
        { str: 'Name', x: 10, y: 10, w: 30, h: 10 },
        { str: 'Shift', x: 120, y: 10, w: 30, h: 10 },
        { str: 'Test A', x: 10, y: 25, w: 30, h: 10 },
        { str: 'Night', x: 120, y: 25, w: 30, h: 10 },
        { str: 'Test B', x: 10, y: 40, w: 30, h: 10 },
        { str: 'Day', x: 120, y: 40, w: 30, h: 10 },
      ],
      0,
    );
    expect(table?.estimated).toBe(true);
    expect(table?.notes[0]).toMatch(/estimated/);
  });
});
