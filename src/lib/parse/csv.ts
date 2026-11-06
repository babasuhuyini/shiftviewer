import Papa from 'papaparse';
import { ImportError, type Extraction } from '../types';
import { clean, finalizeTable } from './util';

function decode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  // UTF-16 BOMs (Excel “Unicode text”)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    // Older Excel exports use Windows-1252.
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

export async function readCsv(buf: ArrayBuffer, fileName: string, delimiter?: string): Promise<Extraction> {
  const text = decode(buf);
  const result = Papa.parse<string[]>(text, { delimiter: delimiter ?? '', skipEmptyLines: false });
  const rows = result.data.map((r) => r.map((v) => ({ text: clean(String(v ?? '')) })));
  const table = finalizeTable({ id: 'csv', label: 'CSV data', rows, notes: [] });
  if (!table.rows.length) {
    throw new ImportError('The CSV file is empty', 'No rows could be read from this file.', ['Export the roster again.']);
  }
  const used = result.meta.delimiter;
  const warnings: string[] = [];
  if (table.rows[0]?.length <= 1) {
    warnings.push('Every row has a single column — the separator may be wrong. Try choosing a different one.');
  }
  return { format: 'csv', fileName, tables: [table], contextText: [], warnings, delimiter: used };
}
