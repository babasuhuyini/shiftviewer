import { Callout, Segmented } from '../components/ui';
import { ShiftChip } from '../components/Shift';
import { isOvernight, type CodeDraft } from '../lib/interpret/codes';
import type { BlankMeaning, CodeKind } from '../lib/types';

const KIND_OPTIONS: { value: CodeKind; label: string }[] = [
  { value: 'shift', label: 'Shift' },
  { value: 'off', label: 'Day off' },
  { value: 'leave', label: 'Leave' },
  { value: 'unknown', label: 'Not sure' },
];

const BLANK_OPTIONS: { value: BlankMeaning; label: string; help: string }[] = [
  { value: 'unassigned', label: 'No shift assigned', help: 'Shown as “No shift assigned” — not as a day off.' },
  { value: 'off', label: 'Day off', help: 'Only choose this if your unit leaves off-days blank.' },
  { value: 'unknown', label: 'Not sure', help: 'Shown as “Blank on roster” so you can check the original.' },
];

export function StepCodes({
  codes,
  blankCount,
  blank,
  remember,
  onCodes,
  onBlank,
  onRemember,
  onBack,
  onNext,
}: {
  codes: CodeDraft[];
  blankCount: number;
  blank: BlankMeaning | null;
  remember: boolean;
  onCodes: (c: CodeDraft[]) => void;
  onBlank: (b: BlankMeaning) => void;
  onRemember: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const update = (key: string, patch: Partial<CodeDraft>) => onCodes(codes.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const missing = codes.filter((c) => c.kind === null || !c.label.trim());
  const needsBlank = blankCount > 0 && blank === null;
  const canContinue = missing.length === 0 && !needsBlank;

  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="step-title">What do the codes mean?</h2>
      <p className="step-lead">
        Every different entry found in the roster is listed below. Shift names differ between units, so please confirm
        each one. Times are optional.
      </p>

      <div className="code-list">
        {codes.map((c) => {
          const overnightAuto = !!(c.start && c.end && c.end <= c.start);
          return (
            <article key={c.key} className={`code-card${c.kind === null ? ' needs-input' : ''}`}>
              <header className="code-head">
                <span className="code-raw" aria-label={`Code ${c.key}`}>
                  {c.variants[0] ?? c.key}
                </span>
                <div className="code-meta">
                  <span>
                    Appears <strong>{c.count}</strong> {c.count === 1 ? 'time' : 'times'}
                  </span>
                  {c.variants.length > 1 && <span className="muted">Also written: {c.variants.slice(1).join(', ')}</span>}
                  {c.merged > 0 && <span className="tag tag-warn">{c.merged} from merged cells</span>}
                </div>
                {c.origin === 'remembered' && <span className="tag">Your earlier setting</span>}
                {c.origin === 'suggested' && <span className="tag">Suggested — please check</span>}
                {c.origin === 'new' && c.kind === null && <span className="tag tag-warn">Needs your choice</span>}
              </header>

              <Segmented label={`Meaning of ${c.key}`} value={c.kind} options={KIND_OPTIONS} onChange={(kind) => update(c.key, { kind })} />

              {c.kind !== null && (
                <div className="code-fields">
                  <label className="field">
                    <span className="field-label">Name to show</span>
                    <input type="text" value={c.label} maxLength={40} onChange={(e) => update(c.key, { label: e.target.value })} />
                  </label>
                  {c.kind === 'shift' && (
                    <>
                      <div className="field-row">
                        <label className="field">
                          <span className="field-label">Starts</span>
                          <input type="time" value={c.start ?? ''} onChange={(e) => update(c.key, { start: e.target.value || undefined })} />
                        </label>
                        <label className="field">
                          <span className="field-label">Ends</span>
                          <input type="time" value={c.end ?? ''} onChange={(e) => update(c.key, { end: e.target.value || undefined })} />
                        </label>
                      </div>
                      <label className={`check${overnightAuto ? ' is-disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={isOvernight(c)}
                          disabled={overnightAuto}
                          onChange={(e) => update(c.key, { overnight: e.target.checked })}
                        />
                        <span>Runs overnight — starts on the date shown and ends the next morning</span>
                      </label>
                    </>
                  )}
                  <div className="code-preview">
                    <span className="muted">Will show as</span>
                    <ShiftChip
                      a={{ kind: c.kind, label: c.label || c.key, code: c.key, overnight: isOvernight(c), start: c.start, end: c.end }}
                    />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {blankCount > 0 && (
        <fieldset className={`field-card${blank === null ? ' needs-input' : ''}`}>
          <legend className="field-card-title">What does an empty cell mean?</legend>
          <p className="field-help">
            {blankCount} {blankCount === 1 ? 'cell is' : 'cells are'} empty. Empty cells are never treated as days off
            unless you say so.
          </p>
          <div className="radio-list">
            {BLANK_OPTIONS.map((o) => (
              <label key={o.value} className={`radio-card${blank === o.value ? ' is-on' : ''}`}>
                <input type="radio" name="blank" value={o.value} checked={blank === o.value} onChange={() => onBlank(o.value)} />
                <span>
                  <strong>{o.label}</strong>
                  <span className="muted">{o.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="check remember">
        <input type="checkbox" checked={remember} onChange={(e) => onRemember(e.target.checked)} />
        <span>Remember these code meanings on this device for the next roster (no names are saved with them)</span>
      </label>

      {!canContinue && (
        <Callout tone="warning">
          <p>
            {missing.length > 0 && `Choose a meaning for: ${missing.map((c) => `“${c.key}”`).join(', ')}. `}
            {needsBlank && 'Choose what an empty cell means.'}
          </p>
        </Callout>
      )}

      <div className="actions sticky-actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={onNext}>
          Review
        </button>
      </div>
    </section>
  );
}
