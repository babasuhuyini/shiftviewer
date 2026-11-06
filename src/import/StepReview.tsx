import { useState } from 'react';
import { Callout } from '../components/ui';
import { ShiftChip } from '../components/Shift';
import { formatMedium, formatRange } from '../lib/dates';
import type { BuildStats } from '../lib/interpret/build';
import type { Draft, Extraction, Issue, Roster } from '../lib/types';

export function StepReview({
  extraction,
  draft,
  built,
  existing,
  saving,
  onBack,
  onAccept,
}: {
  extraction: Extraction;
  draft: Draft;
  built: { roster: Roster; stats: BuildStats; checks: Issue[] };
  existing: Roster | null;
  saving: boolean;
  onBack: () => void;
  onAccept: () => void;
}) {
  const { roster, stats, checks } = built;
  // Start the row check on a person with something worth checking.
  const firstInteresting =
    roster.people.find((p) => roster.entries[p.id].some((a) => a.kind === 'unknown')) ??
    roster.people.find((p) => roster.entries[p.id].some((a) => a.via !== 'cell' && a.via !== 'blank')) ??
    roster.people[0];
  const [checkId, setCheckId] = useState(firstInteresting?.id ?? '');
  const person = roster.people.find((p) => p.id === checkId);
  const unknownPeople = roster.people.filter((p) => roster.entries[p.id].some((a) => a.kind === 'unknown'));
  const warnings = draft.issues.filter((i) => i.level !== 'info');

  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="step-title">Review before using</h2>
      <p className="step-lead">
        {roster.title ? <>“{roster.title}” · </> : null}
        {formatRange(roster.period.start, roster.period.end)} · from {extraction.fileName}
      </p>

      <dl className="stat-grid">
        <div>
          <dt>Staff</dt>
          <dd>{stats.people}</dd>
        </div>
        <div>
          <dt>Days</dt>
          <dd>{stats.days}</dd>
        </div>
        <div>
          <dt>Shifts</dt>
          <dd>{stats.shift}</dd>
        </div>
        <div>
          <dt>Off</dt>
          <dd>{stats.off}</dd>
        </div>
        <div>
          <dt>Leave</dt>
          <dd>{stats.leave}</dd>
        </div>
        <div>
          <dt>Not assigned</dt>
          <dd>{stats.unassigned}</dd>
        </div>
        <div className={stats.unknown ? 'stat-warn' : ''}>
          <dt>Not recognised</dt>
          <dd>{stats.unknown}</dd>
        </div>
      </dl>

      {stats.unknown > 0 && (
        <Callout tone="warning" title={`${stats.unknown} entries weren’t recognised`}>
          <p>
            They’ll be shown with their original text and a “check the official roster” note — never as a confirmed shift.
            Affects: {unknownPeople.slice(0, 5).map((p) => p.name).join(', ')}
            {unknownPeople.length > 5 ? ` and ${unknownPeople.length - 5} more` : ''}.
          </p>
        </Callout>
      )}
      {warnings.map((w) => (
        <Callout key={w.message} tone="warning">
          <p>{w.message}</p>
        </Callout>
      ))}
      {checks.map((c) => (
        <Callout key={c.message} tone="info">
          <p>{c.message}</p>
        </Callout>
      ))}

      <div className="field-card">
        <h3 className="field-card-title">Check a row against the original</h3>
        <p className="field-help">Pick a few people and compare with the paper or PDF roster.</p>
        <label className="field">
          <span className="field-label">Person</span>
          <select value={checkId} onChange={(e) => setCheckId(e.target.value)}>
            {roster.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.details.length ? ` (${p.details.map((d) => d.value).join(', ')})` : ''} — row {p.row}
              </option>
            ))}
          </select>
        </label>
        {person && (
          <div className="table-wrap">
            <table className="check-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">In the file</th>
                  <th scope="col">Will show as</th>
                </tr>
              </thead>
              <tbody>
                {roster.entries[person.id].map((a, i) => (
                  <tr key={`${a.date}-${i}`} className={a.kind === 'unknown' ? 'row-warn' : ''}>
                    <td>{formatMedium(a.date)}</td>
                    <td>
                      <code className="raw">{a.raw || '(blank)'}</code>
                    </td>
                    <td>
                      <ShiftChip a={a} size="sm" />
                      {a.via === 'leave-word' && <span className="via">spelled across days</span>}
                      {a.via === 'leave-gap' && <span className="via">blank between leave words</span>}
                      {a.via === 'merged-cell' && <span className="via">from a merged cell</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {existing && (
        <Callout tone="info" title="This replaces your current roster">
          <p>
            {existing.title ?? existing.fileName} ({formatRange(existing.period.start, existing.period.end)}) will be removed from
            this device.
          </p>
        </Callout>
      )}

      <div className="actions sticky-actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onAccept} disabled={saving}>
          {saving ? 'Saving…' : 'Use this roster'}
        </button>
      </div>
    </section>
  );
}
