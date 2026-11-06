import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ImportError, type Extraction, type RawTable } from '../types';
import { pageToTable, type PdfItem } from './pdfGrid';

// The worker is bundled with the app — nothing is fetched from a CDN.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_PAGES = 30;
/** Fewer readable characters than this means the page is effectively image-only. */
const MIN_TEXT_CHARS = 25;

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

export async function readPdf(buf: ArrayBuffer, fileName: string): Promise<Extraction> {
  let doc: pdfjs.PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buf),
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: false,
    }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name ?? '';
    if (name === 'PasswordException') {
      throw new ImportError('This PDF is password-protected', 'Protected PDFs can’t be opened here.', [
        'Ask for an unprotected copy, or the original Word/Excel file.',
      ]);
    }
    throw new ImportError('This PDF couldn’t be opened', 'The file appears to be damaged or incomplete.', [
      'Download the roster again, or ask for the Word/Excel version.',
    ]);
  }

  const tables: RawTable[] = [];
  const contextText: string[] = [];
  const warnings: string[] = [];
  const scannedPages: number[] = [];
  const garbledPages: number[] = [];
  const pageCount = Math.min(doc.numPages, MAX_PAGES);
  if (doc.numPages > MAX_PAGES) warnings.push(`Only the first ${MAX_PAGES} pages were read.`);

  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const ops = await page.getOperatorList();

    const imageOps = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageMaskXObject]);
    const images = ops.fnArray.filter((fn) => imageOps.has(fn)).length;

    const raw = content.items.filter((i) => 'str' in i) as unknown as TextItemLike[];
    const chars = raw.reduce((n, i) => n + i.str.replace(/\s/g, '').length, 0);
    const bad = raw.reduce((n, i) => n + (i.str.match(/[�-]/g)?.length ?? 0), 0);

    if (chars < MIN_TEXT_CHARS) {
      if (images > 0) scannedPages.push(p);
      continue;
    }
    if (bad / Math.max(1, chars) > 0.2) {
      garbledPages.push(p);
      continue;
    }

    // Bold detection (supporting hint only): look up each font's real name.
    const boldFonts = new Set<string>();
    for (const fontName of new Set(raw.map((i) => i.fontName))) {
      try {
        const font = page.commonObjs.get(fontName) as { name?: string; bold?: boolean; black?: boolean } | undefined;
        if (font && (font.bold || font.black || /bold|black|heavy|demi/i.test(font.name ?? ''))) boldFonts.add(fontName);
      } catch {
        /* font not resolved — ignore */
      }
    }

    const items: PdfItem[] = raw.map((i) => ({
      str: i.str,
      x: i.transform[4],
      y: viewport.height - i.transform[5],
      w: i.width,
      h: i.height || Math.abs(i.transform[3]) || 8,
      bold: boldFonts.has(i.fontName) || undefined,
    }));
    const { table, context } = pageToTable(items, p - 1);
    contextText.push(...context.slice(0, 8));
    if (table) {
      if (images > 0) table.notes.push('This page also contains images. Anything shown only as a picture was not read.');
      tables.push(table);
    }
    page.cleanup();
  }
  await doc.destroy();

  if (scannedPages.length && !tables.length) {
    throw new ImportError(
      'This PDF is a scanned image',
      'The roster in this PDF is a picture of a page, so its text can’t be read reliably. Reading letters like M and N from an image could put someone on the wrong shift.',
      [
        'Ask for the original Word or Excel roster — it imports most accurately.',
        'Or, from Word/Excel, use File → Save As → PDF (not print-to-scan) and import that PDF.',
      ],
    );
  }
  if (garbledPages.length && !tables.length) {
    throw new ImportError('The text in this PDF can’t be decoded', 'The PDF uses fonts whose letters can’t be read back as text.', [
      'Ask for the Word or Excel version of the roster.',
    ]);
  }
  if (!tables.length) {
    throw new ImportError('No roster table found in this PDF', 'The PDF has text, but no grid of names and dates could be found.', [
      'Try the Word or Excel version of the roster.',
    ]);
  }
  if (scannedPages.length) {
    warnings.push(`Page${scannedPages.length > 1 ? 's' : ''} ${scannedPages.join(', ')} look${scannedPages.length > 1 ? '' : 's'} scanned and ${scannedPages.length > 1 ? 'were' : 'was'} skipped. Shifts on ${scannedPages.length > 1 ? 'those pages' : 'that page'} are not included.`);
  }
  if (garbledPages.length) warnings.push(`Text on page ${garbledPages.join(', ')} couldn’t be decoded and was skipped.`);

  // Multi-page rosters: offer all pages combined when they share the same column layout.
  if (tables.length > 1) {
    const width = tables[0].rows[0]?.length;
    const sameShape = tables.every((t) => !t.estimated && t.rows[0]?.length === width);
    if (sameShape) {
      tables.unshift({
        id: 'pages-combined',
        label: `All ${tables.length} pages combined`,
        rows: tables.flatMap((t) => t.rows),
        notes: ['Pages were joined in order. Repeated header rows on later pages are skipped automatically.'],
      });
    }
  }

  return { format: 'pdf', fileName, tables, contextText, warnings };
}
