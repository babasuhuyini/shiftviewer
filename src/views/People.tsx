import { useMemo, useState, type ReactNode } from 'react';
import { Avatar } from '../components/Avatar';
import { ChevronRight, SearchIcon } from '../components/Icons';
import { ShiftChip, timeRange } from '../components/Shift';
import { SettingsLink, TopBar } from '../components/ui';
import { formatLong, relativeLabel, todayISO, WEEKDAYS_SHORT, weekdayOf } from '../lib/dates';
import { colleaguesOn, duplicateNames, personLabel } from '../lib/roster';
import type { Person, Roster } from '../lib/types';

const UPCOMING = 6;

function shortNames(people: Person[]): string {
  if (!people.length) return 'No one else listed';
  const names = people.map((p) => p.name);
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

export function People({ roster, me }: { roster: Roster; me: Person }) {
  const today = todayISO();
  const [q, setQ] = useState('');
  const dupes = useMemo(() => duplicateNames(roster), [roster]);
  const upcoming = (roster.entries[me.id] ?? []).filter((a) => a.date >= today && a.kind === 'shift').slice(0, UPCOMING);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const people = [...roster.people].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return people;
    return people.filter((p) => `${p.name} ${p.details.map((d) => d.value).join(' ')}`.toLowerCase().includes(needle));
  }, [roster, q]);

  return (
    <>
      <TopBar title="People" right={<SettingsLink inShell />} />
      <main className="page page-narrow people-page" id="main">
        <section aria-labelledby="with-you">
          <h2 id="with-you" className="section-title first">
            On your next shifts
          </h2>
          {upcoming.length ? (
            <ul className="row-list">
              {upcoming.map((a) => {
                const others = colleaguesOn(roster, me, a);
                return (
                  <li key={`${a.date}-${a.code}-${a.start ?? ''}`}>
                    <a className="row-link" href={`#/day/${a.date}`}>
                      <span className="date-block" aria-hidden="true">
                        <span className="db-wd">{WEEKDAYS_SHORT[weekdayOf(a.date)]}</span>
                        <span className="db-d">{Number(a.date.slice(8))}</span>
                      </span>
                      <span className="row-main">
                        <span className="visually-hidden">{formatLong(a.date)}. </span>
                        <span className="row-top">
                          <ShiftChip a={a} size="sm" />
                          <span className="muted row-rel">{relativeLabel(a.date, today)}</span>
                        </span>
                        <span className={`row-sub${others.length ? '' : ' muted'}`}>{shortNames(others)}</span>
                      </span>
                      <ChevronRight size={18} />
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">You have no upcoming shifts in this roster.</p>
          )}
        </section>

        <section aria-labelledby="everyone">
          <h2 id="everyone" className="section-title">
            Everyone on this roster <span className="muted count">{roster.people.length}</span>
          </h2>
          <label className="search">
            <SearchIcon size={18} />
            <span className="visually-hidden">Search names</span>
            <input type="search" placeholder="Search names" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </label>
          <ul className="people-pick">
            {list.map((p) => (
              <li key={p.id}>
                <a href={`#/person/${encodeURIComponent(p.id)}`} aria-current={p.id === me.id ? 'true' : undefined}>
                  <Avatar name={p.name} />
                  <span className="pp-text">
                    <span className="pp-name">
                      {p.name}
                      {p.id === me.id && <span className="you-badge">You</span>}
                    </span>
                    {personLabel(p, dupes) && <span className="pp-meta">{personLabel(p, dupes)}</span>}
                  </span>
                  <ChevronRight size={18} />
                </a>
              </li>
            ))}
            {!list.length && <li className="empty-line">No names match “{q}”.</li>}
          </ul>
        </section>
      </main>
    </>
  );
}

export function PersonView({ roster, me, id }: { roster: Roster; me: Person; id: string }) {
  const today = todayISO();
  const [showAll, setShowAll] = useState(false);
  const person = roster.people.find((p) => p.id === id);
  const dupes = useMemo(() => duplicateNames(roster), [roster]);

  if (!person) {
    return (
      <>
        <TopBar title="Person" back={{ href: '#/people', label: 'Back to people' }} />
        <main className="page page-narrow" id="main">
          <p className="muted">This person isn’t in the current roster.</p>
        </main>
      </>
    );
  }

  const isMe = person.id === me.id;
  const theirs = (roster.entries[person.id] ?? []).filter((a) => a.date >= today);
  const together = isMe ? [] : theirs.filter((a) => a.kind === 'shift' && colleaguesOn(roster, me, a).some((p) => p.id === person.id));
  const shown = showAll ? theirs : theirs.slice(0, 14);

  return (
    <>
      <TopBar title={person.name} back={{ href: '#/people', label: 'Back to people' }} />
      <main className="page page-narrow person" id="main">
        <div className="person-head">
          <Avatar name={person.name} />
          <div>
            <p className="person-name">
              {person.name}
              {isMe && <span className="you-badge">You</span>}
            </p>
            {personLabel(person, dupes) && <p className="muted">{personLabel(person, dupes)}</p>}
          </div>
        </div>

        {!isMe && (
          <section aria-labelledby="together">
            <h2 id="together" className="section-title">
              Shifts together
            </h2>
            {together.length ? (
              <ul className="row-list">
                {together.map((a) => (
                  <li key={`${a.date}-${a.code}`}>
                    <DayRow date={a.date} today={today}>
                      <ShiftChip a={a} size="sm" />
                      {timeRange(a) && <span className="muted row-rel">{timeRange(a)}</span>}
                    </DayRow>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">You’re not on any upcoming shifts together in this roster.</p>
            )}
          </section>
        )}

        <section aria-labelledby="their-days">
          <h2 id="their-days" className="section-title">
            {isMe ? 'Your upcoming days' : 'Their upcoming days'}
          </h2>
          {theirs.length ? (
            <ul className="row-list">
              {shown.map((a, i) => (
                <li key={`${a.date}-${i}`}>
                  <DayRow date={a.date} today={today}>
                    <ShiftChip a={a} size="sm" />
                    {a.kind === 'shift' && timeRange(a) && <span className="muted row-rel">{timeRange(a)}</span>}
                  </DayRow>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing upcoming is listed in this roster.</p>
          )}
          {!showAll && theirs.length > shown.length && (
            <button type="button" className="btn btn-small btn-ghost show-more" onClick={() => setShowAll(true)}>
              Show all {theirs.length} days
            </button>
          )}
        </section>

        {!isMe && (
          <p className="field-help swap-note">
            For information only. Seeing someone’s shifts doesn’t mean they are available or allowed to swap — any swap must be agreed
            with them and approved through your unit’s usual process.
          </p>
        )}
      </main>
    </>
  );
}

function DayRow({ date, today, children }: { date: string; today: string; children: ReactNode }) {
  return (
    <a className="row-link" href={`#/day/${date}`}>
      <span className="date-block" aria-hidden="true">
        <span className="db-wd">{WEEKDAYS_SHORT[weekdayOf(date)]}</span>
        <span className="db-d">{Number(date.slice(8))}</span>
      </span>
      <span className="row-main">
        <span className="visually-hidden">{formatLong(date)}. </span>
        <span className="row-top">{children}</span>
        <span className="row-sub muted">{relativeLabel(date, today)}</span>
      </span>
      <ChevronRight size={18} />
    </a>
  );
}
