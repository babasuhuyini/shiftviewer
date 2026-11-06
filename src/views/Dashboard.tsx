import { useState } from 'react';
import { Callout, PrivacyNote, Segmented, TopBar } from '../components/ui';
import { CalendarIcon, ChevronRight, ListIcon, SettingsIcon, UsersIcon } from '../components/Icons';
import { overnightNote, ShiftChip, timeRange } from '../components/Shift';
import { formatDayMonth, formatLong, formatMonthYear, formatRange, localDateOf, parseISO, relativeLabel, todayISO, WEEKDAYS_SHORT, weekdayOf } from '../lib/dates';
import { assignmentsOn, personLabel, duplicateNames, rangesOf } from '../lib/roster';
import { getPrefs, updatePrefs } from '../lib/storage';
import type { Assignment, Person, Roster } from '../lib/types';
import { Agenda } from './Agenda';
import { MonthCalendar } from './MonthCalendar';

export function colleaguesOn(roster: Roster, me: Person, a: Assignment): Person[] {
  return roster.people.filter(
    (p) => p.id !== me.id && assignmentsOn(roster, p.id, a.date).some((x) => x.kind === 'shift' && x.code === a.code && x.start === a.start),
  );
}

export function Dashboard({ roster, me }: { roster: Roster; me: Person }) {
  const today = todayISO();
  const [view, setView] = useState<'calendar' | 'agenda'>(() => getPrefs().view ?? 'calendar');
  const mine = roster.entries[me.id] ?? [];
  const shifts = mine.filter((a) => a.kind === 'shift' && a.date >= today);
  const next = shifts[0];
  const later = shifts.slice(1, 7);
  const todayNonShift = mine.filter((a) => a.date === today && a.kind !== 'shift');
  const offRanges = rangesOf(mine.filter((a) => (a.kind === 'off' || a.kind === 'leave') && a.date >= today)).slice(0, 8);
  const unknownAhead = mine.filter((a) => a.kind === 'unknown' && a.date >= today);
  const { start, end } = roster.period;
  const ended = today > end;
  const notStarted = today < start;
  const dupes = duplicateNames(roster);
  const label = personLabel(me, dupes);
  const { y, m } = parseISO(start);

  const colleagues = next ? colleaguesOn(roster, me, next) : [];

  return (
    <>
      <TopBar
        title="My Shifts"
        right={
          <a className="roster-chip" href="#/roster" aria-label="Roster details and settings">
            <CalendarIcon size={16} />
            <span>{formatMonthYear(y, m)}</span>
            <SettingsIcon size={16} />
          </a>
        }
      />
      <main className="page dash" id="main">
        <p className="whoami">
          Shifts for <strong>{me.name}</strong>
          {label && <span className="muted"> · {label}</span>}{' '}
          <a href="#/nurse" className="link">
            Change
          </a>
        </p>

        <div className="dash-grid">
          <div className="dash-main">
            {notStarted && (
              <Callout tone="info">
                <p>This roster starts on {formatLong(start)}.</p>
              </Callout>
            )}

            {next ? (
              <a className="hero" href={`#/day/${next.date}`} aria-label={`Next shift: ${next.label}, ${formatLong(next.date)}. Open day details.`}>
                <span className="hero-eyebrow">{next.date === today ? 'Today' : `Next shift · ${relativeLabel(next.date, today)}`}</span>
                <span className="hero-shift">
                  <ShiftChip a={next} size="lg" />
                </span>
                <span className="hero-date">{formatLong(next.date)}</span>
                <span className="hero-time">{timeRange(next) || 'Shift times not set'}</span>
                {overnightNote(next) && <span className="hero-note">{overnightNote(next)}</span>}
                <span className="hero-colleagues">
                  <UsersIcon size={18} />
                  {colleagues.length ? (
                    <span>
                      With {colleagues.slice(0, 3).map((p) => p.name).join(', ')}
                      {colleagues.length > 3 ? ` +${colleagues.length - 3} more` : ''}
                    </span>
                  ) : (
                    <span>No one else listed on this shift</span>
                  )}
                  <ChevronRight size={18} />
                </span>
              </a>
            ) : (
              <div className="hero hero-empty">
                <span className="hero-eyebrow">Next shift</span>
                <span className="hero-empty-title">{ended ? 'This roster has ended' : 'No more shifts in this roster'}</span>
                <span className="hero-date">
                  {ended
                    ? `It covered ${formatRange(start, end)}. Import the next roster when it’s available.`
                    : `You have no shifts listed between today and ${formatDayMonth(end)}.`}
                </span>
                <a className="btn btn-primary" href="#/import">
                  Import a newer roster
                </a>
              </div>
            )}

            {todayNonShift.length > 0 && next?.date !== today && (
              <a className="today-line" href={`#/day/${today}`}>
                <span className="muted">Today</span>
                {todayNonShift.map((a, i) => (
                  <ShiftChip key={i} a={a} size="sm" />
                ))}
                <ChevronRight size={16} />
              </a>
            )}

            {unknownAhead.length > 0 && (
              <Callout tone="warning" title="Some entries need checking">
                <p>
                  {unknownAhead.length} upcoming {unknownAhead.length === 1 ? 'day has' : 'days have'} an entry the app couldn’t
                  interpret (
                  {unknownAhead.slice(0, 3).map((a, i) => (
                    <span key={a.date}>
                      {i > 0 && ', '}
                      <a className="link" href={`#/day/${a.date}`}>
                        {formatDayMonth(a.date)}: “{a.raw}”
                      </a>
                    </span>
                  ))}
                  {unknownAhead.length > 3 ? '…' : ''}). Check the official roster for those days.
                </p>
              </Callout>
            )}

            {later.length > 0 && (
              <section className="card" aria-labelledby="coming-up">
                <h2 id="coming-up" className="card-title">
                  Coming up
                </h2>
                <ul className="upcoming">
                  {later.map((a) => (
                    <li key={`${a.date}-${a.code}`}>
                      <a href={`#/day/${a.date}`}>
                        <span className="date-block" aria-hidden="true">
                          <span className="db-wd">{WEEKDAYS_SHORT[weekdayOf(a.date)]}</span>
                          <span className="db-d">{Number(a.date.slice(8))}</span>
                        </span>
                        <span className="up-main">
                          <ShiftChip a={a} size="sm" />
                          <span className="up-sub">
                            <span className="visually-hidden">{formatLong(a.date)}. </span>
                            {relativeLabel(a.date, today)}
                            {timeRange(a) && ` · ${timeRange(a)}`}
                          </span>
                        </span>
                        <ChevronRight size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card" aria-labelledby="days-off">
              <h2 id="days-off" className="card-title">
                Days off &amp; leave
              </h2>
              {offRanges.length ? (
                <ul className="off-list">
                  {offRanges.map((r) => (
                    <li key={r.from}>
                      <a href={`#/day/${r.from}`}>
                        <ShiftChip a={{ kind: r.kind, label: r.label }} size="sm" showCode={false} />
                        <span className="off-when">
                          {formatRange(r.from, r.to)}
                          {r.days > 1 && <span className="muted"> · {r.days} days</span>}
                        </span>
                        <span className="muted off-rel">{relativeLabel(r.from, today)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No upcoming days off or leave are marked for you in this roster.</p>
              )}
              {roster.blankMeaning === 'unassigned' && (
                <p className="field-help">Empty roster cells are shown as “No shift assigned”, not as days off.</p>
              )}
            </section>
          </div>

          <section className="card dash-side" aria-labelledby="schedule">
            <div className="card-head">
              <h2 id="schedule" className="card-title">
                Schedule
              </h2>
              <Segmented
                label="Schedule view"
                value={view}
                onChange={(v) => {
                  setView(v);
                  updatePrefs({ view: v });
                }}
                options={[
                  { value: 'calendar', label: <><CalendarIcon size={16} /> Month</> },
                  { value: 'agenda', label: <><ListIcon size={16} /> List</> },
                ]}
              />
            </div>
            {view === 'calendar' ? <MonthCalendar roster={roster} me={me} today={today} /> : <Agenda roster={roster} me={me} today={today} />}
          </section>
        </div>

        <footer className="dash-foot">
          <p>
            {roster.title ?? roster.fileName} · {formatRange(start, end)} · imported {formatDayMonth(localDateOf(roster.importedAt))}
          </p>
          <PrivacyNote />
        </footer>
      </main>
    </>
  );
}
