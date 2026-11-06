import { useMemo, useState } from 'react';
import { TopBar } from '../components/ui';
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

  const table: RawTable | null = ex?.tables.find((t) => t.id === tableId) ?? null;
  const draft = useMemo(
    () => (table && mapping && period ? buildDraft(table, mapping, period) : null),
    [table, mapping, period],
  );
  const leaveMap = useMemo(() => leaveCells(proposals, gaps), [proposals, gaps]);

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
    setFile(f);
    setError(null);
    setBusy(true);
    try {
      const result = await readRosterFile(f, { delimiter });
      setEx(result);
      // Prefer a table that looks like a roster grid.
      const best = result.tables.find((t) => detectGrid(t, result.contextText, result.fileName)) ?? result.tables[0];
      selectTable(result, best);
      go(result.tables.length > 1 && delimiter === undefined ? 'table' : 'layout');
    } catch (e) {
      setError(
        e instanceof ImportError
          ? e
          : new ImportError('The file couldn’t be read', 'Something went wrong while reading this file.', [
              'Check that the file opens on your computer, then try again.',
              'If it keeps failing, try the Word or Excel version of the roster.',
            ]),
      );
      go('file');
    } finally {
      setBusy(false);
    }
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

        {step === 'file' && <StepFile existing={existing} busy={busy} error={error} onFile={handleFile} onCancel={onCancel} />}

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
