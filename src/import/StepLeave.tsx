import { Callout } from '../components/ui';
import { SuitcaseIcon } from '../components/Icons';
import type { Draft, DraftPerson, LeaveGap, LeaveProposal } from '../lib/types';

function dayNum(p: DraftPerson, seq: number) {
  const e = p.entries.find((x) => x.seq === seq);
  return e ? Number(e.date.slice(8, 10)) : seq + 1;
}

function dayRange(p: DraftPerson, from: number, to: number) {
  const a = dayNum(p, from);
  const b = dayNum(p, to);
  return a === b ? `Day ${a}` : `Days ${a}–${b}`;
}

function seqsLabel(p: DraftPerson, seqs: number[]) {
  const days = seqs.map((s) => dayNum(p, s));
  return days.length === 1 ? `day ${days[0]}` : `days ${days[0]}–${days[days.length - 1]}`;
}

export function StepLeave({
  draft,
  proposals,
  gaps,
  onProposals,
  onGaps,
  onBack,
  onNext,
}: {
  draft: Draft;
  proposals: LeaveProposal[];
  gaps: LeaveGap[];
  onProposals: (p: LeaveProposal[]) => void;
  onGaps: (g: LeaveGap[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const people = draft.people.filter((p) => proposals.some((x) => x.personKey === p.key));
  const accepted = new Set(proposals.filter((p) => p.accepted).map((p) => p.id));
  const setAll = (v: boolean) => onProposals(proposals.map((p) => ({ ...p, accepted: v })));

  return (
    <section aria-labelledby="step-title">
      <h2 id="step-title" className="step-title">Leave written across the days</h2>
      <p className="step-lead">
        Some rows spell words like <strong className="nowrap">A N N U A L</strong> <strong className="nowrap">L E A V E</strong> one
        letter per day. Read letter by
        letter, “A” would look like an afternoon shift and “N” like a night shift. Confirm which of these are leave.
      </p>
      <Callout tone="info">
        <p>
          Anything you untick will be read as ordinary shift codes instead. Blank days between the words follow your
          blank-cell rule (next step) unless you tick them below.
        </p>
      </Callout>

      <div className="bulk-actions">
        <button type="button" className="btn btn-small" onClick={() => setAll(true)}>
          Accept all ({proposals.length})
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => setAll(false)}>
          Untick all
        </button>
      </div>

      <div className="leave-list">
        {people.map((person) => {
          const mine = proposals.filter((p) => p.personKey === person.key);
          const myGaps = gaps.filter((g) => g.personKey === person.key);
          const leaveSeq = new Set(mine.filter((p) => p.accepted).flatMap((p) => Array.from({ length: p.toSeq - p.fromSeq + 1 }, (_, i) => p.fromSeq + i)));
          const gapSeq = new Set(myGaps.filter((g) => g.asLeave && accepted.has(g.between[0]) && accepted.has(g.between[1])).flatMap((g) => g.seqs));
          return (
            <article key={person.key} className="leave-card">
              <header className="leave-head">
                <SuitcaseIcon size={18} />
                <div>
                  <h3>{person.name}</h3>
                  <p className="muted">
                    Row {person.row}
                    {person.details.length > 0 && ` · ${person.details.map((d) => d.value).join(' · ')}`}
                  </p>
                </div>
              </header>

              <ol className="cell-strip" aria-label={`Roster cells for ${person.name}`}>
                {[...person.entries].sort((a, b) => a.seq - b.seq).map((e) => (
                  <li
                    key={e.seq}
                    className={leaveSeq.has(e.seq) ? 'is-leave' : gapSeq.has(e.seq) ? 'is-gap' : ''}
                    aria-label={`Day ${Number(e.date.slice(8, 10))}: ${e.raw || 'blank'}${leaveSeq.has(e.seq) ? ', leave' : ''}`}
                  >
                    <span className="cell-day">{Number(e.date.slice(8, 10))}</span>
                    <span className="cell-val">{e.raw || '·'}</span>
                  </li>
                ))}
              </ol>

              <ul className="proposal-list">
                {mine.map((p) => (
                  <li key={p.id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={p.accepted}
                        onChange={(ev) => onProposals(proposals.map((x) => (x.id === p.id ? { ...x, accepted: ev.target.checked } : x)))}
                      />
                      <span>
                        <strong>{dayRange(person, p.fromSeq, p.toSeq)}</strong> {p.fromSeq === p.toSeq ? 'shows' : 'spell'} “{p.letters.split('').join(' ')}” →{' '}
                        <strong>{p.label}</strong>
                        {p.partial && <span className="tag tag-warn">word cut off at the edge of the roster</span>}
                      </span>
                    </label>
                  </li>
                ))}
                {myGaps.map((g) => {
                  const enabled = accepted.has(g.between[0]) && accepted.has(g.between[1]);
                  return (
                    <li key={g.between.join()} className="gap-item">
                      <label className={`check${enabled ? '' : ' is-disabled'}`}>
                        <input
                          type="checkbox"
                          disabled={!enabled}
                          checked={enabled && g.asLeave}
                          onChange={(ev) => onGaps(gaps.map((x) => (x === g ? { ...x, asLeave: ev.target.checked } : x)))}
                        />
                        <span>
                          Also count the blank {seqsLabel(person, g.seqs)} between these words as <strong>{g.label}</strong>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>

      <div className="actions sticky-actions">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Continue
        </button>
      </div>
    </section>
  );
}
