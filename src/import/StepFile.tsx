import { useRef, useState } from 'react';
import { Callout, PrivacyNote, Spinner } from '../components/ui';
import { FileIcon, UploadIcon } from '../components/Icons';
import { formatRange } from '../lib/dates';
import { ACCEPT } from '../lib/parse';
import type { ImportError, Roster } from '../lib/types';

export function StepFile({
  existing,
  busy,
  error,
  onFile,
  onCancel,
}: {
  existing: Roster | null;
  busy: boolean;
  error: ImportError | null;
  onFile: (f: File) => void;
  onCancel: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
    if (input.current) input.current.value = '';
  };

  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="step-title">Choose your roster file</h2>
      <p className="step-lead">
        Pick the department roster as an Excel, Word, PDF or CSV file. You’ll check how it was read before anything is
        saved, and the original file is never changed.
      </p>

      {existing && (
        <Callout tone="info" title="You already have a roster on this device">
          <p>
            {existing.title ?? existing.fileName} ({formatRange(existing.period.start, existing.period.end)}). Importing a
            new file <strong>replaces it</strong> — but only after you review the new one and choose “Use this roster”.
          </p>
        </Callout>
      )}

      {error && (
        <Callout tone="error" title={error.title}>
          <p>{error.message}</p>
          {error.hints.length > 0 && (
            <ul className="hint-list">
              {error.hints.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
        </Callout>
      )}

      {busy ? (
        <div className="dropzone is-busy">
          <Spinner label="Reading the file on this device…" />
        </div>
      ) : (
        <label
          className={`dropzone${drag ? ' is-drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files);
          }}
        >
          <input ref={input} type="file" accept={ACCEPT} className="visually-hidden" onChange={(e) => pick(e.target.files)} />
          <span className="dropzone-icon">
            <UploadIcon size={28} />
          </span>
          <span className="dropzone-title">Choose a file</span>
          <span className="dropzone-sub">or drop it here</span>
          <span className="format-pills" aria-label="Supported formats">
            <span>.xlsx</span>
            <span>.xls</span>
            <span>.docx</span>
            <span>.pdf</span>
            <span>.csv</span>
          </span>
        </label>
      )}

      <div className="tips">
        <h3>
          <FileIcon size={16} /> Which file works best?
        </h3>
        <ul>
          <li>
            <strong>Word or Excel</strong> versions are read most accurately.
          </li>
          <li>
            <strong>PDF</strong> works if it was saved from Word or Excel. Scanned or photographed rosters can’t be read.
          </li>
          <li>Older Word “.doc” files need to be saved as “.docx” first.</li>
        </ul>
      </div>

      <PrivacyNote />

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
