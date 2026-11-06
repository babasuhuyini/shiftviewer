import { Callout, Segmented } from '../components/ui';
import { CheckIcon } from '../components/Icons';
import { formatDayMonth, MONTHS } from '../lib/dates';
import { DELIMITERS } from '../lib/parse/delimiters';
import {
  colLetter,
  describeColumn,
  detectGrid,
  detectList,
  monthsMatchingWeekdays,
  periodLabel,
  proposeExclusions,
  resolveDates,
  weekdayCheck,
} from '../lib/interpret/layout';
import type { DateOrder, Draft, Extraction, GridMapping, ListMapping, Mapping, Period, RawTable } from '../lib/types';

interface Props {
  extraction: Extraction;
  table: RawTable;
  mapping: Mapping;
  period: Period;
  periodConfirmed: boolean;
  draft: Draft | null;
  onMapping: (m: Mapping) => void;
  onPeriod: (p: Period) => void;
  onPeriodConfirmed: (v: boolean) => void;
  onDelimiter: (d: string) => void;
  onBack: () => void;
  onNext: () => void;
}

const PREVIEW_ROWS = 60;

function yearOptions(current: number): number[] {
  const now = new Date().getFullYear();
  const set = new Set<number>([current]);
  for (let y = now - 2; y <= now + 2; y++) set.add(y);
  return [...set].sort((a, b) => a - b);
}

function emptyGrid(): GridMapping {
  return { kind: 'grid', headerRow: 0, weekdayRow: null, nameCol: 0, detailCols: [], dateCols: [], excludedRows: [], includedOverrides: [] };
}

function defaultList(t: RawTable): ListMapping {
  const w = t.rows[0]?.length ?? 0;
  return {
    kind: 'list',
    headerRow: 0,
    nameCol: 0,
    dateCol: Math.min(1, w - 1),
    shiftCol: Math.min(2, w - 1),
    startCol: null,
    endCol: null,
    detailCols: [],
    dateOrder: 'DMY',
    dateOrderAmbiguous: true,
  };
}

export function StepLayout(props: Props) {
  const { extraction, table, mapping, period, periodConfirmed, draft, onMapping, onPeriod, onPeriodConfirmed, onDelimiter, onBack, onNext } = props;
  const width = table.rows[0]?.length ?? 0;
  const errors = draft?.issues.filter((i) => i.level === 'error') ?? [];
  const warnings = draft?.issues.filter((i) => i.level !== 'error') ?? [];
  const peopleCount = draft?.people.length ?? 0;

  const canContinue =
    !!draft &&
    peopleCount > 0 &&
    errors.length === 0 &&
    (mapping.kind === 'list' || (mapping.dateCols.length > 0 && periodConfirmed));

  const switchLayout = (kind: 'grid' | 'list') => {
    if (kind === mapping.kind) return;
    if (kind === 'grid') onMapping(detectGrid(table, extraction.contextText, extraction.fileName)?.mapping ?? emptyGrid());
    else onMapping(detectList(table) ?? defaultList(table));
  };

  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="step-title">Check how the roster was read</h2>
      <p className="step-lead">
        Make sure the names, dates and month are right. Nothing is saved until the last step.
      </p>

      {[...extraction.warnings, ...table.notes].map((w) => (
        <Callout key={w} tone={table.estimated ? 'warning' : 'info'}>
          <p>{w}</p>
        </Callout>
      ))}

      {extraction.format === 'csv' && (
        <div className="field-card">
          <label className="field">
            <span className="field-label">Column separator</span>
            <select value={extraction.delimiter ?? ''} onChange={(e) => onDelimiter(e.target.value)}>
              {DELIMITERS.map((d) => (
                <option key={d.label} value={d.value}>
                  {d.label}
                  {d.value === '' ? '' : extraction.delimiter === d.value ? ' — in use' : ''}
                </option>
              ))}
            </select>
            <span className="field-help">If everything appears in one column, choose a different separator.</span>
          </label>
        </div>
      )}

      <div className="field-card">
        <span className="field-label" id="layout-label">How is this roster laid out?</span>
        <Segmented
          label="Roster layout"
          value={mapping.kind}
          onChange={switchLayout}
          options={[
            { value: 'grid', label: 'Names down, dates across' },
            { value: 'list', label: 'One row per shift' },
          ]}
        />
      </div>

      {mapping.kind === 'grid' ? (
        renderGridControls(mapping)
      ) : (
        <ListControls table={table} mapping={mapping} onMapping={onMapping} />
      )}

      {draft && peopleCount > 0 && (
        <p className="found-line">
          <CheckIcon size={18} />
          <span>
            Found <strong>{peopleCount}</strong> staff {peopleCount === 1 ? 'row' : 'rows'} and <strong>{draft.dates.length}</strong> dates
            {draft.dates.length > 0 && ` (${formatDayMonth(draft.dates[0])} – ${formatDayMonth(draft.dates[draft.dates.length - 1])})`}.
          </span>
        </p>
      )}

      {errors.map((i) => (
        <Callout key={i.message} tone="error">
          <p>{i.message}</p>
        </Callout>
      ))}
      {warnings.map((i) => (
        <Callout key={i.message} tone={i.level === 'warning' ? 'warning' : 'info'}>
          <p>{i.message}</p>
        </Callout>
      ))}

      <Preview table={table} mapping={mapping} period={period} />

      <div className="actions sticky-actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={onNext}>
          Continue
        </button>
      </div>
      {!canContinue && mapping.kind === 'grid' && !periodConfirmed && mapping.dateCols.length > 0 && (
        <p className="actions-help">Confirm the month and year to continue.</p>
      )}
    </section>
  );

  // A render helper (not a component) so inputs keep focus between renders.
  function renderGridControls(m: GridMapping) {
    const dateColSet = new Set(m.dateCols.map((d) => d.col));
    const labelRows = [m.headerRow, m.weekdayRow ?? -1].filter((r) => r >= 0);
    const check = weekdayCheck(table, m, period);
    const alternatives = check && check.mismatches > 0 ? monthsMatchingWeekdays(table, m, period.year) : [];
    const included = new Set(m.includedOverrides);

    const update = (patch: Partial<GridMapping>) => {
      const next = { ...m, ...patch };
      if ('nameCol' in patch || 'headerRow' in patch) {
        next.excludedRows = proposeExclusions(table, next);
        next.includedOverrides = next.includedOverrides.filter((r) => next.excludedRows.some((e) => e.row === r));
      }
      onMapping(next);
    };

    const setHeaderRow = (r: number) => {
      const det = detectGrid(table, extraction.contextText, extraction.fileName, r);
      if (det) onMapping({ ...det.mapping, nameCol: m.nameCol });
      else onMapping({ ...m, headerRow: r, dateCols: [], excludedRows: [] });
    };

    return (
      <>
        <div className="field-card">
          <h3 className="field-card-title">Month and year</h3>
          <p className="field-help">The month of the first date column in the roster.</p>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Month</span>
              <select value={period.month} onChange={(e) => onPeriod({ ...period, month: Number(e.target.value), source: 'user' })}>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-narrow">
              <span className="field-label">Year</span>
              <select value={period.year} onChange={(e) => onPeriod({ ...period, year: Number(e.target.value), source: 'user' })}>
                {yearOptions(period.year).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {period.source === 'document' && period.evidence && (
            <p className="evidence">Found in the document: “{period.evidence}”</p>
          )}
          {period.source === 'filename' && period.evidence && <p className="evidence">Found in the file name: “{period.evidence}”</p>}
          {period.source === 'cells' && <p className="evidence">Taken from the dates in the roster.</p>}
          {period.source === 'none' && (
            <Callout tone="warning">
              <p>The month and year weren’t found in the file. Please choose them.</p>
            </Callout>
          )}
          {check && check.checked > 0 && check.mismatches === 0 && (
            <p className="good-line">
              <CheckIcon size={16} /> The weekday letters in the roster match {periodLabel(period)}.
            </p>
          )}
          {check && check.mismatches > 0 && (
            <Callout tone="warning" title={`The weekday letters don’t match ${periodLabel(period)}`}>
              <p>
                {check.mismatches} of {check.checked} days disagree with the weekday row in the file.
                {alternatives.length > 0 && <> Months that match: {alternatives.join(', ')}.</>}
              </p>
            </Callout>
          )}
          <label className="check">
            <input type="checkbox" checked={periodConfirmed} onChange={(e) => onPeriodConfirmed(e.target.checked)} />
            <span>
              Yes, this roster starts in <strong>{periodLabel(period)}</strong>
            </span>
          </label>
        </div>

        <div className="field-card">
          <h3 className="field-card-title">Columns</h3>
          <label className="field">
            <span className="field-label">Row with the dates</span>
            <select value={m.headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
              {table.rows.slice(0, 30).map((r, i) => (
                <option key={i} value={i}>
                  Row {i + 1}: {r.map((c) => c.text).filter(Boolean).slice(0, 6).join(' · ').slice(0, 60) || '(empty)'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Column with staff names</span>
            <select value={m.nameCol} onChange={(e) => update({ nameCol: Number(e.target.value), detailCols: m.detailCols.filter((c) => c !== Number(e.target.value)) })}>
              {Array.from({ length: width }, (_, c) => c)
                .filter((c) => !dateColSet.has(c))
                .map((c) => (
                  <option key={c} value={c}>
                    {describeColumn(table, c, labelRows)}
                  </option>
                ))}
            </select>
          </label>
          {width > 1 && (
            <fieldset className="field">
              <legend className="field-label">Extra details to show with names (e.g. rank)</legend>
              <div className="check-grid">
                {Array.from({ length: width }, (_, c) => c)
                  .filter((c) => !dateColSet.has(c) && c !== m.nameCol)
                  .map((c) => (
                    <label key={c} className="check">
                      <input
                        type="checkbox"
                        checked={m.detailCols.includes(c)}
                        onChange={(e) =>
                          update({ detailCols: e.target.checked ? [...m.detailCols, c].sort((a, b) => a - b) : m.detailCols.filter((x) => x !== c) })
                        }
                      />
                      <span>{describeColumn(table, c, labelRows)}</span>
                    </label>
                  ))}
              </div>
            </fieldset>
          )}
          <p className="field-help">
            Date columns: {m.dateCols.length ? `${colLetter(m.dateCols[0].col)}–${colLetter(m.dateCols[m.dateCols.length - 1].col)} (${m.dateCols.length} days)` : 'none found in this row'}
          </p>
        </div>

        {m.excludedRows.length > 0 && (
          <div className="field-card">
            <h3 className="field-card-title">Rows that will be skipped</h3>
            <p className="field-help">These don’t look like staff. Tick any row that is actually a person.</p>
            <ul className="skip-list">
              {m.excludedRows.map((e) => (
                <li key={e.row}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={included.has(e.row)}
                      onChange={(ev) =>
                        onMapping({
                          ...m,
                          includedOverrides: ev.target.checked ? [...m.includedOverrides, e.row] : m.includedOverrides.filter((r) => r !== e.row),
                        })
                      }
                    />
                    <span>
                      <strong>Row {e.row + 1}</strong> “{table.rows[e.row]?.[m.nameCol]?.text || '(no name)'}” — {e.reason}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }
}

function ListControls({ table, mapping: m, onMapping }: { table: RawTable; mapping: ListMapping; onMapping: (m: Mapping) => void }) {
  const width = table.rows[0]?.length ?? 0;
  const headerRows = m.headerRow >= 0 ? [m.headerRow] : [];
  const cols = Array.from({ length: width }, (_, c) => c);
  const sel = (label: string, value: number | null, onChange: (v: number | null) => void, optional = false) => (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value ?? -1} onChange={(e) => onChange(Number(e.target.value) < 0 ? null : Number(e.target.value))}>
        {optional && <option value={-1}>Not in this file</option>}
        {cols.map((c) => (
          <option key={c} value={c}>
            {describeColumn(table, c, headerRows)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="field-card">
      <h3 className="field-card-title">Columns</h3>
      <label className="check">
        <input type="checkbox" checked={m.headerRow >= 0} onChange={(e) => onMapping({ ...m, headerRow: e.target.checked ? 0 : -1 })} />
        <span>The first row contains column titles</span>
      </label>
      <div className="field-grid">
        {sel('Staff name', m.nameCol, (v) => onMapping({ ...m, nameCol: v ?? 0 }))}
        {sel('Date', m.dateCol, (v) => onMapping({ ...m, dateCol: v ?? 0 }))}
        {sel('Shift', m.shiftCol, (v) => onMapping({ ...m, shiftCol: v ?? 0 }))}
        {sel('Start time', m.startCol, (v) => onMapping({ ...m, startCol: v }), true)}
        {sel('End time', m.endCol, (v) => onMapping({ ...m, endCol: v }), true)}
      </div>
      <label className="field">
        <span className="field-label">Date format</span>
        <select value={m.dateOrder} onChange={(e) => onMapping({ ...m, dateOrder: e.target.value as DateOrder, dateOrderAmbiguous: false })}>
          <option value="DMY">Day first — 03/11/2026 is 3 November</option>
          <option value="MDY">Month first — 03/11/2026 is 11 March</option>
          <option value="YMD">Year first — 2026-11-03</option>
        </select>
        {m.dateOrderAmbiguous && <span className="field-help warn-text">The dates could be read either way — please confirm the format.</span>}
      </label>
    </div>
  );
}

function Preview({ table, mapping, period }: { table: RawTable; mapping: Mapping; period: Period }) {
  const width = table.rows[0]?.length ?? 0;
  const rows = table.rows.slice(0, PREVIEW_ROWS);
  const excluded = mapping.kind === 'grid' ? new Map(mapping.excludedRows.filter((e) => !mapping.includedOverrides.includes(e.row)).map((e) => [e.row, e.reason])) : new Map<number, string>();
  const dateByCol = mapping.kind === 'grid' ? new Map(resolveDates(mapping.dateCols, period).map((d) => [d.col, d.date])) : new Map<number, string | null>();

  const roleOf = (c: number): string => {
    if (mapping.kind === 'grid') {
      if (c === mapping.nameCol) return 'Name';
      if (mapping.detailCols.includes(c)) return 'Detail';
      const d = dateByCol.get(c);
      if (d) return formatDayMonth(d);
      return '';
    }
    if (c === mapping.nameCol) return 'Name';
    if (c === mapping.dateCol) return 'Date';
    if (c === mapping.shiftCol) return 'Shift';
    if (c === mapping.startCol) return 'Start';
    if (c === mapping.endCol) return 'End';
    if (mapping.detailCols.includes(c)) return 'Detail';
    return '';
  };
  const headerRow = mapping.headerRow;

  return (
    <div className="preview-card">
      <h3 className="field-card-title">Preview of the file</h3>
      <p className="field-help">
        Highlighted: names and the date row. Struck-through rows are skipped.{' '}
        {table.rows.length > PREVIEW_ROWS && `Showing the first ${PREVIEW_ROWS} of ${table.rows.length} rows.`}
      </p>
      <div className="preview-scroll" tabIndex={0} role="region" aria-label="File preview (scrolls sideways)">
        <table className="preview">
          <thead>
            <tr>
              <th className="pv-corner" scope="col">
                <span className="visually-hidden">Row</span>
              </th>
              {Array.from({ length: width }, (_, c) => (
                <th key={c} scope="col" className={roleOf(c) ? 'pv-role' : ''}>
                  <span className="pv-letter">{colLetter(c)}</span>
                  {roleOf(c) && <span className="pv-tag">{roleOf(c)}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr
                key={ri}
                className={[ri === headerRow ? 'pv-header' : '', excluded.has(ri) ? 'pv-excluded' : '', mapping.kind === 'grid' && ri === mapping.weekdayRow ? 'pv-header' : ''].join(' ')}
                title={excluded.get(ri)}
              >
                <th scope="row" className="pv-rownum">
                  {ri + 1}
                </th>
                {r.map((cell, c) => (
                  <td
                    key={c}
                    className={[
                      c === mapping.nameCol ? 'pv-name' : '',
                      cell.mergedFrom ? 'pv-merged' : '',
                      cell.bold ? 'pv-bold' : '',
                    ].join(' ')}
                    title={cell.mergedFrom ? `Merged cell: “${cell.mergedFrom}”` : undefined}
                  >
                    {cell.text || (cell.mergedFrom ? '↔' : '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
