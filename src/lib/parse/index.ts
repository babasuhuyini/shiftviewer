import { ImportError, type Extraction, type SourceFormat } from '../types';

export const ACCEPT = '.xlsx,.xls,.docx,.pdf,.csv,application/pdf,text/csv';
export const MAX_BYTES = 25 * 1024 * 1024;

function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
}

async function sniff(buf: ArrayBuffer): Promise<'zip' | 'ole' | 'pdf' | 'text' | 'unknown'> {
  const b = new Uint8Array(buf.slice(0, 8));
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'zip';
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'ole';
  const head = new TextDecoder('latin1').decode(new Uint8Array(buf.slice(0, 1024)));
  if (head.includes('%PDF-')) return 'pdf';
  // Mostly printable → probably text (CSV).
  const sample = new Uint8Array(buf.slice(0, 2048));
  let printable = 0;
  for (const c of sample) if (c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127)) printable++;
  return sample.length && printable / sample.length > 0.95 ? 'text' : 'unknown';
}

async function zipKind(buf: ArrayBuffer): Promise<'docx' | 'xlsx' | 'other'> {
  const JSZip = (await import('jszip')).default;
  try {
    const zip = await JSZip.loadAsync(buf);
    if (zip.file('word/document.xml')) return 'docx';
    if (zip.file('xl/workbook.xml')) return 'xlsx';
    return 'other';
  } catch {
    return 'other';
  }
}

/** Work out the real format from the file's bytes (the extension can be wrong). */
export async function detectFormat(file: File, buf: ArrayBuffer): Promise<SourceFormat> {
  const ext = extOf(file.name);
  const magic = await sniff(buf);

  if (magic === 'pdf') return 'pdf';
  if (magic === 'zip') {
    const kind = await zipKind(buf);
    if (kind === 'docx' || kind === 'xlsx') return kind;
    if (ext === 'pptx') throw unsupported('PowerPoint files');
    if (ext === 'odt' || ext === 'ods') {
      throw new ImportError(
        'OpenDocument files aren’t supported',
        'This looks like an OpenDocument (LibreOffice) file.',
        ['Open it and choose “Save As” → Word (.docx) or Excel (.xlsx), then import that copy.'],
      );
    }
    throw unreadable();
  }
  if (magic === 'ole') {
    if (ext === 'doc') {
      throw new ImportError(
        'Older Word (.doc) files aren’t supported',
        'This is a Word 97–2003 document, which can’t be read reliably in the browser.',
        ['Open it in Word and choose File → Save As → Word Document (.docx).', 'Then import the new .docx copy.'],
      );
    }
    // Excel 97–2003 workbooks also use this container.
    return 'xls';
  }
  if (magic === 'text' && (ext === 'csv' || ext === 'txt' || ext === 'tsv')) return 'csv';
  if (magic === 'text' && ext === 'xls') return 'xls'; // some systems export HTML/TSV with .xls
  if (magic === 'text') return 'csv';

  if (['png', 'jpg', 'jpeg', 'heic', 'gif', 'webp'].includes(ext)) {
    throw new ImportError(
      'Photos of a roster can’t be read',
      'This is an image file. The app only reads rosters that contain real text.',
      ['Ask for the roster as a Word, Excel or PDF file (exported, not scanned).'],
    );
  }
  throw unreadable();
}

function unsupported(what: string) {
  return new ImportError(`${what} aren’t supported`, `${what} can’t be used as a roster.`, [
    'Use the roster as an Excel (.xlsx/.xls), Word (.docx), PDF or CSV file.',
  ]);
}

function unreadable() {
  return new ImportError('This file couldn’t be recognised', 'The file isn’t a readable Excel, Word, PDF or CSV file.', [
    'Check that you picked the roster file and that it opens on your computer.',
    'If it came from email or WhatsApp, download it again — partial downloads can’t be read.',
  ]);
}

export interface ReadOptions {
  /** CSV only: forced delimiter. */
  delimiter?: string;
}

/**
 * Read a file entirely in the browser. Parsers are loaded only when needed so phones
 * don't download the PDF reader to open a spreadsheet.
 */
export async function readRosterFile(file: File, opts: ReadOptions = {}): Promise<Extraction> {
  if (file.size === 0) {
    throw new ImportError('The file is empty', 'This file has no content.', ['Download or export the roster again.']);
  }
  if (file.size > MAX_BYTES) {
    throw new ImportError('The file is too large', 'Roster files over 25 MB aren’t supported.', [
      'Remove images or extra sheets from a copy of the file, or export just the roster.',
    ]);
  }
  const buf = await file.arrayBuffer();
  const format = await detectFormat(file, buf);
  switch (format) {
    case 'pdf':
      return (await import('./pdf')).readPdf(buf, file.name);
    case 'docx':
      return (await import('./docx')).readDocx(buf, file.name);
    case 'xlsx':
    case 'xls':
      return (await import('./xlsx')).readWorkbook(buf, file.name, format);
    case 'csv':
      return (await import('./csv')).readCsv(buf, file.name, opts.delimiter);
  }
}
