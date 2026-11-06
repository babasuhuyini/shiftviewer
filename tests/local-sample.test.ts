/**
 * Optional check against REAL roster files kept outside the repository.
 * Skipped unless paths are given, e.g. (PowerShell):
 *   $env:ROSTER_SAMPLE_DOCX="C:\path\roster.docx"; $env:ROSTER_SAMPLE_PDF="C:\path\roster.pdf"; npx vitest run tests/local-sample.test.ts
 * Prints only counts — never names or shifts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readDocx } from '../src/lib/parse/docx';
import { pageToTable, type PdfItem } from '../src/lib/parse/pdfGrid';
import { detectGrid } from '../src/lib/interpret/layout';
import { buildDraft } from '../src/lib/interpret/draft';
import { detectLeave, leaveCells } from '../src/lib/interpret/leave';
import { collectCodes } from '../src/lib/interpret/codes';
import { buildRoster } from '../src/lib/interpret/build';
import type { Extraction, Roster } from '../src/lib/types';

const DOCX = process.env.ROSTER_SAMPLE_DOCX;
const PDF = process.env.ROSTER_SAMPLE_PDF;

function interpret(ex: Extraction): Roster {
  const table = ex.tables[0];
  const det = detectGrid(table, ex.contextText, ex.fileName);
  expect(det, 'grid detected').toBeTruthy();
  const draft = buildDraft(table, det!.mapping, det!.period);
  const { proposals, gaps } = detectLeave(draft);
  const leaveMap = leaveCells(proposals, gaps);
  const { codes, blankCount } = collectCodes(draft, leaveMap);
  console.log(
    `[${ex.format}] period=${det!.period.year}-${det!.period.month} (${det!.period.source}, ${det!.confidence}) ` +
      `people=${draft.people.length} dates=${draft.dates.length} excluded=${det!.mapping.excludedRows.length} ` +
      `leaveWords=${proposals.length} partial=${proposals.filter((p) => p.partial).length} gaps=${gaps.length} ` +
      `codes=${codes.map((c) => `${c.key}:${c.count}`).join(',')} blanks=${blankCount} issues=${draft.issues.length}`,
  );
  const { roster, checks } = buildRoster({
    extraction: ex,
    table,
    draft,
    blankMeaning: 'unassigned',
    leaveMap,
    codes: [
      { key: 'M', kind: 'shift', label: 'Morning' },
      { key: 'A', kind: 'shift', label: 'Afternoon' },
      { key: 'N', kind: 'shift', label: 'Night', overnight: true },
      { key: 'X', kind: 'off', label: 'Off' },
    ],
  });
  checks.forEach((c) => console.log(`[${ex.format}] check: ${c.message}`));
  return roster;
}

async function pdfExtraction(path: string): Promise<Extraction> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path)), disableFontFace: true }).promise;
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items: PdfItem[] = (content.items as { str?: string; transform: number[]; width: number; height: number }[])
    .filter((i) => typeof i.str === 'string')
    .map((i) => ({ str: i.str!, x: i.transform[4], y: vp.height - i.transform[5], w: i.width, h: i.height || 8 }));
  const { table, context } = pageToTable(items, 0);
  expect(table).toBeTruthy();
  return { format: 'pdf', fileName: 'sample.pdf', tables: [table!], contextText: context, warnings: [] };
}

describe.skipIf(!DOCX || !PDF)('real sample rosters (local only)', () => {
  it('Word and PDF versions produce the same roster', async () => {
    const buf = readFileSync(DOCX!);
    const docx = await readDocx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'sample.docx');
    const a = interpret(docx);
    const b = interpret(await pdfExtraction(PDF!));

    // Compare without printing names (assertion diffs would show them).
    expect(b.people.length, 'people count').toBe(a.people.length);
    const nameDiffs = a.people.filter((p, i) => p.name !== b.people[i].name).map((p) => p.row);
    const detailDiffs = a.people
      .filter((p, i) => p.details.map((d) => d.value).join() !== b.people[i].details.map((d) => d.value).join())
      .map((p) => p.row);
    console.log(`name mismatches at rows: [${nameDiffs.join(', ')}]; detail mismatches at rows: [${detailDiffs.join(', ')}]`);
    expect(nameDiffs.length, 'name mismatches').toBe(0);
    expect(detailDiffs.length, 'detail mismatches').toBe(0);
    let diffs = 0;
    for (let i = 0; i < a.people.length; i++) {
      const ea = a.entries[a.people[i].id];
      const eb = b.entries[b.people[i].id];
      expect(eb.length).toBe(ea.length);
      ea.forEach((x, j) => {
        if (x.date !== eb[j].date || x.raw !== eb[j].raw || x.kind !== eb[j].kind || x.label !== eb[j].label) {
          diffs++;
          console.log(`diff row ${a.people[i].row} ${x.date}: docx=${x.kind}/${x.raw} pdf=${eb[j].kind}/${eb[j].raw}`);
        }
      });
    }
    const cells = a.people.reduce((n, p) => n + a.entries[p.id].length, 0);
    console.log(`cells compared: ${cells} diffs=${diffs}`);
    expect(diffs).toBe(0);
  });
});
