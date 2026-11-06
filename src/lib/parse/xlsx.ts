import * as XLSX from 'xlsx';
import { toISO, isValidYMD } from '../dates';
import { ImportError, type Extraction, type RawCell, type RawTable } from '../types';
import { clean, finalizeTable } from './util';

const MAX_ROWS = 1000;
const MAX_COLS = 200;

function cellDate(cell: XLSX.CellObject): string | undefined {
  // Numeric cell with a date number format → convert the serial without any time zone.
  if (cell.t === 'n' && typeof cell.v === 'number' && cell.z && XLSX.SSF.is_date(String(cell.z))) {
    const p = XLSX.SSF.parse_date_code(cell.v);
    if (p && isValidYMD(p.y, p.m, p.d)) return toISO(p.y, p.m, p.d);
  }
  return undefined;
}

export async function readWorkbook(buf: ArrayBuffer, fileName: string, format: 'xlsx' | 'xls'): Promise<Extraction> {
  let wb: XLSX.WorkBook;
  try {
    // cellNF keeps number formats so dates can be recognised; cellDates stays off to avoid time-zone conversion.
    wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellNF: true, cellText: true, cellDates: false, cellStyles: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/password|encrypt/i.test(msg)) {
      throw new ImportError('This workbook is password-protected', 'Protected workbooks can’t be opened in the browser.', [
        'Open it in Excel, remove the password (File → Info → Protect Workbook), and save a copy.',
      ]);
    }
    throw new ImportError('This spreadsheet couldn’t be opened', 'The file appears to be damaged or isn’t a real Excel file.', [
      'Open it in Excel and use “Save As” → Excel Workbook (.xlsx).',
      'If it’s an older Word .doc file renamed to .xls, save it from Word as .docx instead.',
    ]);
  }

  const tables: RawTable[] = [];
  const contextText: string[] = [];
  const warnings: string[] = [];
  if (wb.Props?.Title) contextText.push(clean(String(wb.Props.Title)));

  wb.SheetNames.forEach((sheetName, si) => {
    const ws = wb.Sheets[sheetName];
    const hidden = wb.Workbook?.Sheets?.[si]?.Hidden;
    if (!ws || !ws['!ref']) return;
    contextText.push(sheetName);

    const range = XLSX.utils.decode_range(ws['!ref']);
    const notes: string[] = [];
    let lastRow = range.e.r;
    let lastCol = range.e.c;
    if (lastRow - range.s.r + 1 > MAX_ROWS) {
      lastRow = range.s.r + MAX_ROWS - 1;
      notes.push(`Only the first ${MAX_ROWS} rows are shown.`);
    }
    if (lastCol - range.s.c + 1 > MAX_COLS) {
      lastCol = range.s.c + MAX_COLS - 1;
      notes.push(`Only the first ${MAX_COLS} columns are shown.`);
    }

    const rows: RawCell[][] = [];
    for (let r = range.s.r; r <= lastRow; r++) {
      const row: RawCell[] = [];
      for (let c = range.s.c; c <= lastCol; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
        if (!cell || cell.v === undefined || cell.v === null) {
          row.push({ text: '' });
          continue;
        }
        // `w` is the text exactly as Excel displays it.
        const text = clean(cell.w ?? String(cell.v));
        const dateISO = cellDate(cell);
        row.push(dateISO ? { text, dateISO } : { text });
      }
      rows.push(row);
    }

    // Merged cells: keep the text in the first cell only; mark covered cells so nothing is duplicated silently.
    const merges = ws['!merges'] ?? [];
    let mergedCount = 0;
    for (const m of merges) {
      const origin = rows[m.s.r - range.s.r]?.[m.s.c - range.s.c];
      if (!origin || !origin.text) continue;
      mergedCount++;
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          if (r === m.s.r && c === m.s.c) continue;
          const target = rows[r - range.s.r]?.[c - range.s.c];
          if (target) {
            target.text = '';
            target.mergedFrom = origin.text;
          }
        }
      }
    }
    if (mergedCount) {
      notes.push(`${mergedCount} merged cell${mergedCount === 1 ? '' : 's'} found. Merged text is marked on every day it covers so you can check it.`);
    }
    const hiddenRows = (ws['!rows'] ?? []).filter((r) => r?.hidden).length;
    if (hiddenRows) notes.push(`${hiddenRows} hidden row${hiddenRows === 1 ? ' is' : 's are'} included. Hidden rows may be old or draft entries — check them.`);
    if (hidden) notes.push('This sheet is hidden in Excel.');

    const label = `Sheet “${sheetName}”${hidden ? ' (hidden)' : ''}`;
    const t = finalizeTable({ id: `sheet-${si}`, label, rows, notes });
    if (t.rows.length) tables.push(t);
  });

  if (!tables.length) {
    throw new ImportError('The workbook is empty', 'None of the sheets contain any cells.', [
      'Check that you picked the right file.',
    ]);
  }
  return { format, fileName, tables, contextText, warnings };
}
