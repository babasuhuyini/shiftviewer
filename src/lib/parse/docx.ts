import JSZip from 'jszip';
import { ImportError, type Extraction, type RawCell, type RawTable } from '../types';
import { clean, finalizeTable, tableFromLines } from './util';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function attr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null;
  return el.getAttributeNS(W, name) ?? el.getAttribute(`w:${name}`);
}

function child(el: Element, local: string): Element | null {
  for (const c of Array.from(el.children)) if (c.localName === local && c.namespaceURI === W) return c;
  return null;
}

/** Direct children with a local name, looking through content controls (w:sdt). */
function kids(el: Element, local: string): Element[] {
  const out: Element[] = [];
  for (const c of Array.from(el.children)) {
    if (c.namespaceURI !== W) continue;
    if (c.localName === local) out.push(c);
    else if (c.localName === 'sdt') {
      const content = child(c, 'sdtContent');
      if (content) out.push(...kids(content, local));
    } else if (c.localName === 'customXml' || c.localName === 'smartTag') {
      out.push(...kids(c, local));
    }
  }
  return out;
}

function isOn(el: Element | null): boolean {
  if (!el) return false;
  const v = attr(el, 'val');
  return v === null || !['0', 'false', 'off', 'none'].includes(v.toLowerCase());
}

interface TextInfo {
  text: string;
  bold: boolean;
}

/** Text of an element, skipping nested tables and deleted text. Tracks whether all text is bold. */
function textOf(el: Element): TextInfo {
  const parts: string[] = [];
  let anyText = false;
  let allBold = true;
  const walk = (node: Element) => {
    for (const c of Array.from(node.children)) {
      if (c.namespaceURI !== W) {
        // Walk into unknown wrappers (e.g. mc:AlternateContent → take the first branch only).
        if (c.localName === 'AlternateContent') {
          const first = c.firstElementChild;
          if (first) walk(first);
        }
        continue;
      }
      switch (c.localName) {
        case 'tbl':
        case 'del':
        case 'rPr':
        case 'pPr':
          continue;
        case 'p':
          if (parts.length && !/\s$/.test(parts[parts.length - 1])) parts.push(' ');
          walk(c);
          break;
        case 'r': {
          const rPr = child(c, 'rPr');
          const bold = isOn(rPr ? child(rPr, 'b') : null) || isOn(rPr ? child(rPr, 'bCs') : null);
          for (const rc of Array.from(c.children)) {
            if (rc.namespaceURI !== W) continue;
            if (rc.localName === 't') {
              const t = rc.textContent ?? '';
              if (t.trim()) {
                anyText = true;
                if (!bold) allBold = false;
              }
              parts.push(t);
            } else if (rc.localName === 'tab' || rc.localName === 'br' || rc.localName === 'cr') {
              parts.push(' ');
            }
          }
          break;
        }
        default:
          walk(c);
      }
    }
  };
  walk(el);
  return { text: clean(parts.join('')), bold: anyText && allBold };
}

function readTable(tbl: Element, index: number): RawTable {
  const rows: RawCell[][] = [];
  // Column index → text of the vertically merged cell above, for w:vMerge continuations.
  const vmergeText = new Map<number, string>();
  let mergedCells = 0;

  for (const tr of kids(tbl, 'tr')) {
    const row: RawCell[] = [];
    const trPr = child(tr, 'trPr');
    const before = Number(attr(trPr ? child(trPr, 'gridBefore') : null, 'val') ?? 0);
    for (let i = 0; i < before; i++) row.push({ text: '' });

    for (const tc of kids(tr, 'tc')) {
      const tcPr = child(tc, 'tcPr');
      const span = Math.max(1, Number(attr(tcPr ? child(tcPr, 'gridSpan') : null, 'val') ?? 1));
      const vMergeEl = tcPr ? child(tcPr, 'vMerge') : null;
      const vMerge = vMergeEl ? (attr(vMergeEl, 'val') ?? 'continue') : null;
      const info = textOf(tc);
      const col = row.length;

      if (vMerge === 'continue') {
        const above = vmergeText.get(col) ?? '';
        for (let i = 0; i < span; i++) row.push({ text: '', mergedFrom: above || undefined });
        if (above) mergedCells++;
        continue;
      }
      if (vMerge === 'restart') vmergeText.set(col, info.text);
      else vmergeText.delete(col);

      row.push({ text: info.text, bold: info.bold || undefined });
      for (let i = 1; i < span; i++) row.push({ text: '', mergedFrom: info.text || undefined });
      if (span > 1 && info.text) mergedCells++;
    }
    rows.push(row);
  }

  const notes: string[] = [];
  if (mergedCells) {
    notes.push(
      `${mergedCells} merged cell${mergedCells === 1 ? '' : 's'} found. Merged text is shown on every day it covers and marked for you to check.`,
    );
  }
  return finalizeTable({ id: `docx-${index}`, label: `Table ${index + 1}`, rows, notes });
}

export async function readDocx(buf: ArrayBuffer, fileName: string): Promise<Extraction> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new ImportError('This Word file couldn’t be opened', 'The file appears to be damaged or password-protected.', [
      'Open it in Word to check it works, remove any password, then save a new copy.',
    ]);
  }
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new ImportError('This isn’t a readable Word document', 'The file has no document content.', [
      'Open it in Word and use “Save As” → Word Document (.docx).',
    ]);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(await docFile.async('string'), 'application/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body) throw new ImportError('This Word file couldn’t be read', 'The document body is missing.', []);

  // Top-level tables only (a table inside a table cell is read as part of that cell's text).
  const tables: RawTable[] = [];
  const looseLines: string[] = [];
  const walkBody = (el: Element) => {
    for (const c of Array.from(el.children)) {
      if (c.namespaceURI !== W) continue;
      if (c.localName === 'tbl') tables.push(readTable(c, tables.length));
      else if (c.localName === 'p') {
        const t = textOf(c).text;
        if (t) looseLines.push(t);
      } else if (c.localName === 'sdt') {
        const content = child(c, 'sdtContent');
        if (content) walkBody(content);
      }
    }
  };
  walkBody(body);

  // Page headers/footers usually hold the roster title (e.g. "… NOVEMBER 2026 TIME TABLE").
  const contextText: string[] = [];
  const headerFiles = Object.keys(zip.files)
    .filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n))
    .sort();
  for (const name of headerFiles) {
    const xml = parser.parseFromString(await zip.file(name)!.async('string'), 'application/xml');
    const t = textOf(xml.documentElement).text;
    if (t) contextText.push(t);
  }
  contextText.push(...looseLines.slice(0, 30));
  const core = zip.file('docProps/core.xml');
  if (core) {
    const xml = parser.parseFromString(await core.async('string'), 'application/xml');
    const title = xml.getElementsByTagName('dc:title')[0]?.textContent;
    if (title) contextText.push(clean(title));
  }

  const usable = tables.filter((t) => t.rows.length >= 2);
  const warnings: string[] = [];
  if (!usable.length) {
    const est = tableFromLines('docx-text', 'Document text', looseLines, 'This document has no table. Columns were estimated from tabs and spacing — check them carefully.');
    if (!est) {
      throw new ImportError('No roster table found', 'This Word document doesn’t contain a table or column-aligned text.', [
        'If the roster is a picture inside the document, it can’t be read.',
        'Ask for the roster as an Excel file, or a Word file with a real table.',
      ]);
    }
    usable.push(est);
    warnings.push('No table was found in this Word document, so the text was split into columns automatically.');
  }

  return { format: 'docx', fileName, tables: usable, contextText, warnings };
}
