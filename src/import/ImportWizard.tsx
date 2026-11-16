import { useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from '../components/ui';
import { failureEvent, track } from '../lib/analytics';
import { buildDraft } from '../lib/interpret/draft';
import { buildRoster } from '../lib/interpret/build';
import { collectCodes, suggestCodes, type CodeDraft } from '../lib/interpret/codes';
import { detectGrid, detectList } from '../lib/interpret/layout';
import { detectLeave, leaveCells } from '../lib/interpret/leave';
import { readRosterFile } from '../lib/parse';
import { getPrefs, updatePrefs } from '../lib/storage';
import {
  ImportError,
  type BlankMeaning,
  type CodeDef,
  type Extraction,
  type LeaveGap,
  type LeaveProposal,
  type Mapping,
  type Period,
  type RawTable,
  type Roster,
} from '../lib/types';
import { StepCodes } from './StepCodes';
import { StepFile } from './StepFile';
import { StepLayout } from './StepLayout';
import { StepLeave } from './StepLeave';
import { StepReview } from './StepReview';
import { StepTable } from './StepTable';

/** Reading normally takes a second or two; past this, something is stuck. */
const READ_TIMEOUT_MS = 60_000;
class ReadTimeout extends Error {}

/** A helpful message for failures the readers didn't anticipate (never shows raw error text). */
function unexpectedError(file: File, timedOut: boolean): ImportError {
  const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
  const hints = isPdf
    ? [
        'Update your browser (or your phone’s software) and try again — older browsers can’t read some PDFs.',
        'Or use the Word or Excel version of the roster, which is read most reliably.',
      ]
    : ['Check that the file opens on your device, then try again.', 'If it keeps failing, try the Word or Excel version of the roster.'];
  return timedOut
    ? new ImportError('Reading this file took too long', `“${file.name}” couldn’t be read within a minute, so the app stopped trying.`, hints)
    : new ImportError('The file couldn’t be read', `Something went wrong while reading “${file.name}”. Nothing was saved or changed.`, hints);
}

type Step = 'file' | 'table' | 'layout' | 'leave' | 'codes' | 'review';

const STEP_LABELS: Record<Step, string> = {
  file: 'Choose file',
  table: 'Pick table',
  layout: 'Check layout',
  leave: 'Leave',
  codes: 'Shift codes',
  review: 'Review',
};

export interface WizardProps {
  existing: Roster | null;
  onCancel: () => void;
  onAccept: (roster: Roster) => Promise<void> | void;
}

export function ImportWizard({ existing, onCancel, onAccept }: WizardProps) {
  const [step, setStep] = useState<Step>('file');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ImportError | null>(null);
  const [ex, setEx] = useState<Extraction | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [periodConfirmed, setPeriodConfirmed] = useState(false);
  const [proposals, setProposals] = useState<LeaveProposal[]>([]);
  const [gaps, setGaps] = useState<LeaveGap[]>([]);
  const [codes, setCodes] = useState<CodeDraft[]>([]);
  const [blankCount, setBlankCount] = useState(0);
  const [blank, setBlank] = useState<BlankMeaning | null>(null);
  const [remember, setRemember] = useState(true);
  const [saving, setSaving] = useState(false);
  // Each read gets a number; a cancelled or superseded read is ignored when it finishes.
  const readRun = useRef(0);

  const table: RawTable | null = ex?.tables.find((t) => t.id === tableId) ?? null;
  const draft = useMemo(
    () => (table && mapping && period ? buildDraft(table, mapping, period) : null),
    [table, mapping, period],
  );
  const leaveMap = useMemo(() => leaveCells(proposals, gaps), [proposals, gaps]);

  // Tell keyboard and screen-reader users the step changed: focus its heading.
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const h = document.getElementById('step-title');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
  }, [step]);

  const steps: Step[] = ['file', ...(ex && ex.tables.length > 1 ? (['table'] as Step[]) : []), 'layout', ...(proposals.length ? (['leave'] as Step[]) : []), 'codes', 'review'];
  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  function selectTable(extraction: Extraction, t: RawTable) {
    setTableId(t.id);
    setProposals([]);
    setGaps([]);
    const grid = detectGrid(t, extraction.contextText, extraction.fileName);
    if (grid) {
      setMapping(grid.mapping);
      setPeriod(grid.period);
    } else {
      const list = detectList(t);
      setMapping(list);
      setPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, source: 'none' });
    }
    setPeriodConfirmed(false);
  }

  async function handleFile(f: File, delimiter?: string) {
    const run = ++readRun.current;
    setFile(f);
    setError(null);
    setBusy(true);
    if (delimiter === undefined) track('import_started');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        readRosterFile(f, { delimiter }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new ReadTimeout()), READ_TIMEOUT_MS);
        }),
      ]);
      if (run !== readRun.current) return;
      setEx(result);
      // Prefer a table that looks like a roster grid.
      const best = result.tables.find((t) => detectGrid(t, result.contextText, result.fileName)) ?? result.tables[0];
      selectTable(result, best);
      go(result.tables.length > 1 && delimiter === undefined ? 'table' : 'layout');
    } catch (e) {
      if (run !== readRun.current) return;
      const shown = e instanceof ImportError ? e : unexpectedError(f, e instanceof ReadTimeout);
      track(e instanceof ImportError ? failureEvent(e.title, false) : failureEvent('', e instanceof ReadTimeout));
      setError(shown);
      go('file');
    } finally {
      clearTimeout(timer);
      if (run === readRun.current) setBusy(false);
    }
  }

  /** Stop waiting for the current read (the reader may finish in the background; its result is ignored). */
  function cancelRead() {
    readRun.current++;
    setBusy(false);
  }

  function continueFromLayout() {
    if (!draft) return;
    const found = detectLeave(draft);
    // Keep earlier accept/reject choices when coming back to this step.
    const prevP = new Map(proposals.map((p) => [p.id, p.accepted]));
    const prevG = new Map(gaps.map((g) => [g.between.join(), g.asLeave]));
    const p = found.proposals.map((x) => ({ ...x, accepted: prevP.get(x.id) ?? x.accepted }));
    const g = found.gaps.map((x) => ({ ...x, asLeave: prevG.get(x.between.join()) ?? x.asLeave }));
    setProposals(p);
    setGaps(g);
    if (p.length) go('leave');
    else prepareCodes(p, g);
  }

  function prepareCodes(p = proposals, g = gaps) {
    if (!draft) return;
    const { codes: stats, blankCount: blanks } = collectCodes(draft, leaveCells(p, g));
    const prefs = getPrefs();
    const prev = new Map(codes.map((c) => [c.key, c]));
    const next = suggestCodes(stats, prefs.codes ?? []).map((c) => {
      const keep = prev.get(c.key);
      return keep ? { ...keep, count: c.count, variants: c.variants, merged: c.merged } : c;
    });
    setCodes(next);
    setBlankCount(blanks);
    if (blank === null && blanks > 0 && prefs.blankMeaning) setBlank(prefs.blankMeaning);
    go('codes');
  }

  const confirmedCodes: CodeDef[] = codes
    .filter((c) => c.kind !== null)
    .map(({ key, kind, label, start, end, overnight }) => ({ key, kind: kind!, label: label.trim() || key, start: start || undefined, end: end || undefined, overnight }));

  const built = useMemo(() => {
    if (step !== 'review' || !ex || !table || !draft) return null;
    return buildRoster({ extraction: ex, table, draft, codes: confirmedCodes, blankMeaning: blank ?? 'unassigned', leaveMap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ex, table, draft, leaveMap, codes, blank]);

  async function accept() {
    if (!built) return;
    setSaving(true);
    try {
      if (remember) {
        const prefs = getPrefs();
        const others = (prefs.codes ?? []).filter((c) => !confirmedCodes.some((n) => n.key === c.key));
        updatePrefs({ codes: [...others, ...confirmedCodes], blankMeaning: blank ?? prefs.blankMeaning });
      }
      await onAccept(built.roster);
      track('import_succeeded');
    } finally {
      setSaving(false);
    }
  }

  const idx = steps.indexOf(step);

  return (
    <>
      <TopBar title="Import roster" back={{ href: '#/', label: 'Cancel import' }} />
      <main className="page page-narrow" id="main">
        <nav className="stepper" aria-label="Import progress">
          <ol>
            {steps.map((s, i) => (
              <li key={s} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>
                <span className="stepper-dot">{i + 1}</span>
                <span className="stepper-label">{STEP_LABELS[s]}</span>
              </li>
            ))}
          </ol>
        </nav>

        {step === 'file' && <StepFile existing={existing} busy={busy} error={error} onFile={handleFile} onCancelRead={cancelRead} onCancel={onCancel} />}

        {step === 'table' && ex && (
          <StepTable
            extraction={ex}
            selected={tableId}
            onSelect={(t) => selectTable(ex, t)}
            onBack={() => go('file')}
            onNext={() => go('layout')}
          />
        )}

        {step === 'layout' && ex && table && mapping && period && (
          <StepLayout
            extraction={ex}
            table={table}
            mapping={mapping}
            period={period}
            periodConfirmed={periodConfirmed}
            draft={draft}
            onMapping={setMapping}
            onPeriod={(p) => {
              setPeriod(p);
              setPeriodConfirmed(false);
            }}
            onPeriodConfirmed={setPeriodConfirmed}
            onDelimiter={(d) => file && handleFile(file, d)}
            onBack={() => go(ex.tables.length > 1 ? 'table' : 'file')}
            onNext={continueFromLayout}
          />
        )}

        {step === 'leave' && draft && (
          <StepLeave
            draft={draft}
            proposals={proposals}
            gaps={gaps}
            onProposals={setProposals}
            onGaps={setGaps}
            onBack={() => go('layout')}
            onNext={() => prepareCodes()}
          />
        )}

        {step === 'codes' && (
          <StepCodes
            codes={codes}
            blankCount={blankCount}
            blank={blank}
            remember={remember}
            onCodes={setCodes}
            onBlank={setBlank}
            onRemember={setRemember}
            onBack={() => go(proposals.length ? 'leave' : 'layout')}
            onNext={() => go('review')}
          />
        )}

        {step === 'review' && built && draft && ex && (
          <StepReview
            extraction={ex}
            draft={draft}
            built={built}
            existing={existing}
            saving={saving}
            onBack={() => go('codes')}
            onAccept={accept}
          />
        )}
      </main>
    </>
  );
}
