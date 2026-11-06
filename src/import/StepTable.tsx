import { Callout } from '../components/ui';
import { CheckIcon } from '../components/Icons';
import { detectGrid } from '../lib/interpret/layout';
import type { Extraction, RawTable } from '../lib/types';

export function StepTable({
  extraction,
  selected,
  onSelect,
  onBack,
  onNext,
}: {
  extraction: Extraction;
  selected: string | null;
  onSelect: (t: RawTable) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const kind = extraction.format === 'pdf' ? 'page' : extraction.format === 'docx' ? 'table' : 'sheet';
  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="step-title">Which {kind} has the roster?</h2>
      <p className="step-lead">This file has {extraction.tables.length} {kind}s. Choose the one with staff names and dates.</p>
      {extraction.warnings.map((w) => (
        <Callout key={w} tone="warning">
          <p>{w}</p>
        </Callout>
      ))}
      <div className="choice-list" role="radiogroup" aria-label={`Choose a ${kind}`}>
        {extraction.tables.map((t) => {
          const looksLikeRoster = !!detectGrid(t, extraction.contextText, extraction.fileName);
          const on = t.id === selected;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} className={`choice${on ? ' is-on' : ''}`} onClick={() => onSelect(t)}>
              <span className="choice-head">
                <span className="choice-title">{t.label}</span>
                {looksLikeRoster && <span className="tag tag-good">Looks like a roster</span>}
                {on && <CheckIcon size={18} />}
              </span>
              <span className="choice-meta">
                {t.rows.length} rows × {t.rows[0]?.length ?? 0} columns
              </span>
              <span className="mini-preview" aria-hidden="true">
                {t.rows.slice(0, 4).map((r, i) => (
                  <span key={i}>{r.slice(0, 8).map((c) => c.text || '·').join('  ')}</span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn-primary" disabled={!selected} onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}
