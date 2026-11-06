import { useMemo, useState } from 'react';
import { Callout, PrivacyNote, TopBar } from '../components/ui';
import { CheckIcon, SearchIcon, UserIcon } from '../components/Icons';
import { duplicateNames, personLabel } from '../lib/roster';
import type { Person, Roster, SelectedNurse } from '../lib/types';

export function NursePicker({
  roster,
  current,
  previous,
  onPick,
}: {
  roster: Roster;
  current: Person | null;
  previous: SelectedNurse | undefined;
  onPick: (p: Person) => void;
}) {
  const [q, setQ] = useState('');
  const dupes = useMemo(() => duplicateNames(roster), [roster]);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const people = [...roster.people].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return people;
    return people.filter((p) => `${p.name} ${p.details.map((d) => d.value).join(' ')}`.toLowerCase().includes(needle));
  }, [roster, q]);
  const lostPrevious = previous && !current;

  return (
    <>
      <TopBar title="Choose your name" back={current ? { href: '#/', label: 'Back to my shifts' } : undefined} />
      <main className="page page-narrow" id="main">
        <p className="step-lead">
          Pick your name from this roster to see your shifts. This is remembered on this device only.
        </p>

        {lostPrevious && (
          <Callout tone="warning" title="Please choose your name again">
            <p>
              “{previous.name}” wasn’t found exactly once in this roster, so the app won’t guess. Names or ranks may have
              changed, or the name appears more than once.
            </p>
          </Callout>
        )}

        {current && (
          <button type="button" className="current-pick" onClick={() => onPick(current)}>
            <UserIcon size={20} />
            <span>
              <span className="muted">Continue as</span>
              <strong>{current.name}</strong>
              {personLabel(current, dupes) && <span className="muted">{personLabel(current, dupes)}</span>}
            </span>
            <CheckIcon size={20} />
          </button>
        )}

        <label className="search">
          <SearchIcon size={18} />
          <span className="visually-hidden">Search names</span>
          <input type="search" placeholder={`Search ${roster.people.length} names`} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </label>

        <ul className="people-pick">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p)} aria-current={current?.id === p.id ? 'true' : undefined}>
                <span className="pp-name">{p.name}</span>
                <span className="pp-meta">{personLabel(p, dupes)}</span>
              </button>
            </li>
          ))}
          {!list.length && <li className="empty-line">No names match “{q}”.</li>}
        </ul>
        {dupes.size > 0 && (
          <p className="field-help">Some names appear more than once; their roster row number is shown to tell them apart.</p>
        )}
        <PrivacyNote />
      </main>
    </>
  );
}
