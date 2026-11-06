import { useState } from 'react';
import { ConfirmDialog, PrivacyNote, TopBar } from '../components/ui';
import { TrashIcon, UploadIcon, UserIcon } from '../components/Icons';
import { CodeLegend } from '../components/Shift';
import { formatLong, formatRange, localDateOf } from '../lib/dates';
import type { Person, Roster } from '../lib/types';

const FORMAT_NAMES: Record<Roster['format'], string> = { xlsx: 'Excel', xls: 'Excel (97–2003)', docx: 'Word', pdf: 'PDF', csv: 'CSV' };
const BLANK_TEXT: Record<Roster['blankMeaning'], string> = {
  unassigned: 'No shift assigned',
  off: 'Day off',
  unknown: 'Not sure (shown as “Blank on roster”)',
};

export function RosterInfo({ roster, me, onRemove }: { roster: Roster; me: Person; onRemove: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <TopBar title="Roster" back={{ href: '#/', label: 'Back to my shifts' }} />
      <main className="page page-narrow" id="main">
        <section className="card">
          <h2 className="card-title">Current roster</h2>
          <dl className="info-list">
            {roster.title && (
              <div>
                <dt>Title</dt>
                <dd>{roster.title}</dd>
              </div>
            )}
            <div>
              <dt>Period</dt>
              <dd>{formatRange(roster.period.start, roster.period.end)}</dd>
            </div>
            <div>
              <dt>File</dt>
              <dd>
                {roster.fileName} <span className="muted">({FORMAT_NAMES[roster.format]}, {roster.tableLabel})</span>
              </dd>
            </div>
            <div>
              <dt>Imported</dt>
              <dd>{formatLong(localDateOf(roster.importedAt))}</dd>
            </div>
            <div>
              <dt>Staff listed</dt>
              <dd>{roster.people.length}</dd>
            </div>
            <div>
              <dt>Empty cells mean</dt>
              <dd>{BLANK_TEXT[roster.blankMeaning]}</dd>
            </div>
            <div>
              <dt>Showing shifts for</dt>
              <dd>{me.name}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2 className="card-title">Shift codes</h2>
          <CodeLegend codes={roster.codes} />
        </section>

        {roster.notes.length > 0 && (
          <details className="card notes">
            <summary className="card-title">Notes from the import ({roster.notes.length})</summary>
            <ul>
              {roster.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        )}

        <div className="action-stack">
          <a className="btn btn-primary btn-block" href="#/import">
            <UploadIcon size={18} /> Import a newer roster
          </a>
          <a className="btn btn-block" href="#/nurse">
            <UserIcon size={18} /> Change selected name
          </a>
          <button type="button" className="btn btn-danger-outline btn-block" onClick={() => setConfirm(true)}>
            <TrashIcon size={18} /> Remove roster from this device
          </button>
        </div>

        <PrivacyNote />

        <ConfirmDialog
          open={confirm}
          title="Remove this roster?"
          confirmLabel="Remove roster"
          danger
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            setConfirm(false);
            await onRemove();
          }}
        >
          <p>
            The roster and your selected name will be deleted from this device. Your original file is not affected. Shift code
            meanings you chose are kept for the next import (they contain no names).
          </p>
        </ConfirmDialog>
      </main>
    </>
  );
}
