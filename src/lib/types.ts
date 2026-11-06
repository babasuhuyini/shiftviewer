/** Calendar date as plain text, YYYY-MM-DD. Never converted through a time zone. */
export type ISODate = string;

// ───────────────────────── Extraction (format readers → generic tables) ─────────────────────────

export interface RawCell {
  /** Text as displayed in the source, whitespace collapsed. */
  text: string;
  /** All text in the cell is bold (used only as a supporting hint). */
  bold?: boolean;
  /** Set when the source cell is a real date value (e.g. an Excel date). */
  dateISO?: ISODate;
  /** When this cell is covered by a merged cell, the merged cell's text. `text` is then ''. */
  mergedFrom?: string;
}

export interface RawTable {
  id: string;
  /** Human label, e.g. "Table 1", "Sheet “Nov”", "Page 1". */
  label: string;
  /** Rectangular grid of cells (rows padded to equal length). */
  rows: RawCell[][];
  /** Reader notes about this table that the user should see. */
  notes: string[];
  /** True when the grid was estimated (text split into columns), not a real table. */
  estimated?: boolean;
}

export type SourceFormat = 'xlsx' | 'xls' | 'docx' | 'pdf' | 'csv';

export interface Extraction {
  format: SourceFormat;
  fileName: string;
  tables: RawTable[];
  /** Titles, page headers, sheet names and loose text — used to find the roster period. */
  contextText: string[];
  /** File-level warnings to show in the review. */
  warnings: string[];
  /** CSV only: delimiter used. */
  delimiter?: string;
}

/** A readable, fixable import failure. */
export class ImportError extends Error {
  title: string;
  hints: string[];
  constructor(title: string, message: string, hints: string[] = []) {
    super(message);
    this.name = 'ImportError';
    this.title = title;
    this.hints = hints;
  }
}

// ───────────────────────── Layout mapping (user-confirmed) ─────────────────────────

export interface DateColumn {
  col: number;
  /** Day-of-month as shown in the header (null when the header holds a full date). */
  day: number | null;
  /** Full date if the header cell itself is a date. */
  iso?: ISODate;
  /** Original header text. */
  text: string;
}

export interface GridMapping {
  kind: 'grid';
  headerRow: number;
  weekdayRow: number | null;
  nameCol: number;
  detailCols: number[];
  dateCols: DateColumn[];
  /** Rows the detector proposes to skip, with reasons. */
  excludedRows: { row: number; reason: string }[];
  /** Rows the user chose to include despite the proposal. */
  includedOverrides: number[];
}

export type DateOrder = 'DMY' | 'MDY' | 'YMD';

export interface ListMapping {
  kind: 'list';
  /** -1 when the table has no header row. */
  headerRow: number;
  nameCol: number;
  dateCol: number;
  shiftCol: number;
  startCol: number | null;
  endCol: number | null;
  detailCols: number[];
  dateOrder: DateOrder;
  /** True when the order could not be determined from the data. */
  dateOrderAmbiguous: boolean;
}

export type Mapping = GridMapping | ListMapping;

export interface Period {
  year: number;
  /** 1–12: month of the FIRST date column. */
  month: number;
  /** Where the suggestion came from, shown to the user. */
  source: 'cells' | 'document' | 'filename' | 'user' | 'none';
  /** The text the period was found in, if any. */
  evidence?: string;
}

// ───────────────────────── Draft (extracted, not yet confirmed) ─────────────────────────

export interface DraftEntry {
  date: ISODate;
  raw: string;
  bold?: boolean;
  /** Text came from a merged cell that spans this date. */
  merged?: boolean;
  /** List layout: times as given in the file. */
  startText?: string;
  endText?: string;
  /** Grid: index of the date column (adjacency for spelled-out words). */
  seq: number;
}

export interface DraftPerson {
  key: string;
  row: number;
  name: string;
  details: Detail[];
  entries: DraftEntry[];
}

export interface Detail {
  label: string;
  value: string;
}

export interface Draft {
  layout: 'grid' | 'list';
  dates: ISODate[];
  people: DraftPerson[];
  issues: Issue[];
  /** Grid: rows skipped as totals/summary, kept for an informational cross-check. */
  summaryRows: { label: string; values: Map<ISODate, string> }[];
}

export interface Issue {
  level: 'error' | 'warning' | 'info';
  message: string;
}

// ───────────────────────── Leave words spelled across cells ─────────────────────────

export interface LeaveProposal {
  id: string;
  personKey: string;
  /** seq range, inclusive. */
  fromSeq: number;
  toSeq: number;
  letters: string;
  label: string;
  /** The word was cut off at the start or end of the roster. */
  partial: boolean;
  allBold: boolean;
  accepted: boolean;
}

export interface LeaveGap {
  personKey: string;
  seqs: number[];
  label: string;
  /** Ids of the leave words on either side. */
  between: [string, string];
  /** User chose to treat these blank days as leave. */
  asLeave: boolean;
}

// ───────────────────────── Shift codes ─────────────────────────

export type CodeKind = 'shift' | 'off' | 'leave' | 'unknown';

export interface CodeDef {
  /** Normalised key (trimmed, upper-case). */
  key: string;
  kind: CodeKind;
  label: string;
  /** HH:MM, optional. */
  start?: string;
  end?: string;
  /** The shift runs past midnight into the next day. */
  overnight?: boolean;
}

export type BlankMeaning = 'unassigned' | 'off' | 'unknown';

// ───────────────────────── Confirmed roster ─────────────────────────

export type AssignmentKind = 'shift' | 'off' | 'leave' | 'unassigned' | 'unknown';

export interface Assignment {
  date: ISODate;
  /** Exactly what the source cell said. */
  raw: string;
  kind: AssignmentKind;
  /** Code key when the cell matched a code. */
  code?: string;
  label: string;
  start?: string;
  end?: string;
  overnight?: boolean;
  via: 'cell' | 'leave-word' | 'leave-gap' | 'merged-cell' | 'blank';
}

export interface Person {
  id: string;
  name: string;
  details: Detail[];
  /** Source row (1-based) to tell duplicates apart. */
  row: number;
}

export interface Roster {
  schema: 1;
  fileName: string;
  format: SourceFormat;
  tableLabel: string;
  title?: string;
  /** Local date-time string of when the import was accepted. */
  importedAt: string;
  period: { start: ISODate; end: ISODate };
  people: Person[];
  codes: CodeDef[];
  blankMeaning: BlankMeaning;
  /** personId → assignments sorted by date. */
  entries: Record<string, Assignment[]>;
  /** Issues accepted during import, kept for reference. */
  notes: string[];
}

export interface SelectedNurse {
  name: string;
  details: Detail[];
  row: number;
}
