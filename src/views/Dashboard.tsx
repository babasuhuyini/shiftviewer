import { useState } from 'react';
import { Avatar, AvatarStack } from '../components/Avatar';
import { Callout, PrivacyNote, Segmented, TopBar } from '../components/ui';
import { CalendarIcon, ChevronRight, ClockIcon, FileIcon, ListIcon, SettingsIcon, ToneIcon, UploadIcon, UserIcon, UsersIcon } from '../components/Icons';
import { overnightNote, ShiftChip, timeRange } from '../components/Shift';
import { WelcomeMessage } from '../components/WelcomeMessage';
import {
  addDays,
  diffDays,
  formatDayMonth,
  formatLong,
  formatMedium,
  formatMonthYear,
  formatRange,
  localDateOf,
  MONTHS,
  parseISO,
  relativeLabel,
  todayISO,
  WEEKDAYS,
  WEEKDAYS_SHORT,
  weekdayOf,
} from '../lib/dates';
import { assignmentsOn, duplicateNames, personLabel, rangesOf, toneOf } from '../lib/roster';
import { getPrefs, updatePrefs } from '../lib/storage';
import type { Assignment, ISODate, Person, Roster } from '../lib/types';
import { Agenda } from './Agenda';
import { MonthCalendar } from './MonthCalendar';

export function colleaguesOn(roster: Roster, me: Person, a: Assignment): Person[] {
  return roster.people.filter(
    (p) => p.id !== me.id && assignmentsOn(roster, p.id, a.date).some((x) => x.kind === 'shift' && x.code === a.code && x.start === a.start),
  );
}

function markText(a: Assignment): string {
  switch (a.kind) {
    case 'shift':
      return a.code && a.code.length <= 3 ? a.code : a.label.slice(0, 3);
    case 'off':
      return 'Off';
    case 'leave':
      return 'Leave';
    case 'unassigned':
      return '–';
    default:
      return '?';
  }
}

export function Dashboard({ roster, me }: { roster: Roster; me: Person }) {
  const today = todayISO();
  const [view, setView] = useState<'calendar' | 'agenda'>(() => getPrefs().view ?? 'calendar');
  const mine = roster.entries[me.id] ?? [];
  const ahead = mine.filter((a) => a.date >= today);
  const shifts = ahead.filter((a) => a.kind === 'shift');
  const next = shifts[0];
  const later = shifts.slice(1, 6);
  const offRanges = rangesOf(ahead.filter((a) => a.kind === 'off' || a.kind === 'leave')).slice(0, 6);
  const unknownAhead = ahead.filter((a) => a.kind === 'unknown');
  const { start, end } = roster.period;
  const ended = today > end;
  const notStarted = today < start;
  const endsSoon = !ended && diffDays(today, end) <= 5;
  const dupes = duplicateNames(roster);
  const label = personLabel(me, dupes);
  const { y, m } = parseISO(start);
  const colleagues = next ? colleaguesOn(roster, me, next) : [];

  const stats = {
    shifts: shifts.length,
    off: new Set(ahead.filter((a) => a.kind === 'off').map((a) => a.date)).size,
    leave: new Set(ahead.filter((a) => a.kind === 'leave').map((a) => a.date)).size,
  };

  // Seven days from today (or from the roster start if it hasn't begun).
  const stripStart: ISODate = notStarted ? start : today;
  const week: ISODate[] = ended ? [] : Array.from({ length: 7 }, (_, i) => addDays(stripStart, i));

  return (
    <>
      <TopBar
        title="My Shifts"
        right={
          <a className="roster-chip" href="#/roster" aria-label={`Roster for ${formatMonthYear(y, m)} — details and settings`}>
            <CalendarIcon size={16} />
            <span>{MONTHS[m - 1].slice(0, 3)} {y}</span>
            <SettingsIcon size={16} />
          </a>
        }
      />
      <main className="page dash" id="main">
        <WelcomeMessage />

        <div className="whoami">
          <Avatar name={me.name} />
          <p>
            <span className="muted">Showing shifts for</span>
            <strong>{me.name}</strong>
            {label && <span className="muted whoami-meta">{label}</span>}
          </p>
          <a href="#/nurse" className="btn btn-small btn-soft">
            Change
          </a>
        </div>

        <div className="dash-grid">
          <div className="dash-main">
            {notStarted && (
              <Callout tone="info">
                <p>This roster starts on {formatLong(start)}.</p>
              </Callout>
            )}

            {next ? (
              <section className={`hero wash-${toneOf(next)}`} aria-labelledby="next-shift-label">
                <div className="hero-top">
                  <span className="hero-eyebrow" id="next-shift-label">
                    Your next shift
                  </span>
                  <span className="pill">{relativeLabel(next.date, today)}</span>
                </div>
                <h2 className="hero-date">
                  <span className="hero-weekday">{WEEKDAYS[weekdayOf(next.date)]}</span>
                  <span>
                    {Number(next.date.slice(8))} {MONTHS[parseISO(next.date).m - 1]}
                  </span>
                </h2>
                <div className="hero-shift">
                  <ShiftChip a={next} size="lg" />
                </div>
                <p className={`hero-time${timeRange(next) ? '' : ' is-missing'}`}>
                  <ClockIcon size={18} />
                  {timeRange(next) || 'Start and end times aren’t on the roster'}
                </p>
                {overnightNote(next) && <p className="hero-note">{overnightNote(next)}</p>}

                <div className="hero-team">
                  {colleagues.length ? (
                    <>
                      <AvatarStack names={colleagues.map((p) => p.name)} />
                      <p>
                        <span className="muted">Working with </span>
                        {colleagues.slice(0, 2).map((p) => p.name).join(', ')}
                        {colleagues.length > 2 && ` and ${colleagues.length - 2} more`}
                      </p>
                    </>
                  ) : (
                    <>
                      <UsersIcon size={18} />
                      <p className="muted">No one else is listed on this shift.</p>
                    </>
                  )}
                </div>
                <a className="btn btn-primary hero-cta" href={`#/day/${next.date}`}>
                  See everyone working this day <ChevronRight size={18} />
                </a>
              </section>
            ) : (
              <section className="hero hero-empty" aria-labelledby="no-shift">
                <span className="hero-eyebrow">Your next shift</span>
                <h2 className="hero-empty-title" id="no-shift">
                  {ended ? 'This roster has ended' : 'No more shifts in this roster'}
                </h2>
                <p className="hero-empty-text">
                  {ended
                    ? `It covered ${formatRange(start, end)}. Import the next roster when it’s available.`
                    : `You have no shifts listed between today and ${formatDayMonth(end)}. Enjoy the rest.`}
                </p>
                <a className="btn btn-primary" href="#/import">
                  <UploadIcon size={18} /> Import a newer roster
                </a>
              </section>
            )}

            {week.length > 0 && (
              <section className="card week-card" aria-labelledby="week-title">
                <div className="card-head">
                  <h2 id="week-title" className="card-title">
                    {notStarted ? 'First week' : 'Next 7 days'}
                  </h2>
                </div>
                <ol className="week-strip">
                  {week.map((date) => {
                    const inRange = date >= start && date <= end;
                    const list = inRange ? assignmentsOn(roster, me.id, date) : [];
                    const first = list[0];
                    const tone = first ? toneOf(first) : 'none';
                    const desc = !inRange ? 'outside this roster' : first ? list.map((a) => (a.kind === 'unknown' ? `unrecognised “${a.raw}”` : a.label)).join(' and ') : 'not listed';
                    return (
                      <li key={date}>
                        {inRange ? (
                          <a
                            href={`#/day/${date}`}
                            className={`week-day tone-${tone}${date === today ? ' is-today' : ''}`}
                            aria-label={`${formatLong(date)}${date === today ? ' (today)' : ''}: ${desc}`}
                          >
                            <span className="wd-name">{date === today ? 'Today' : WEEKDAYS_SHORT[weekdayOf(date)]}</span>
                            <span className="wd-num">{Number(date.slice(8))}</span>
                            <span className="wd-mark">
                              {first ? (
                                <>
                                  <ToneIcon tone={toneOf(first)} size={13} />
                                  <span>{markText(first)}</span>
                                </>
                              ) : (
                                <span>–</span>
                              )}
                            </span>
                          </a>
                        ) : (
                          <span className="week-day is-outside" aria-label={`${formatLong(date)}: outside this roster`}>
                            <span className="wd-name">{WEEKDAYS_SHORT[weekdayOf(date)]}</span>
                            <span className="wd-num">{Number(date.slice(8))}</span>
                            <span className="wd-mark">
                              <span>—</span>
                            </span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {!ended && (
              <dl className="glance" aria-label="Left in this roster">
                <div>
                  <dt>Shifts left</dt>
                  <dd>{stats.shifts}</dd>
                </div>
                <div>
                  <dt>Days off</dt>
                  <dd>{stats.off}</dd>
                </div>
                <div>
                  <dt>Leave days</dt>
                  <dd>{stats.leave}</dd>
                </div>
              </dl>
            )}

            {endsSoon && (
              <Callout tone="info" title="This roster is nearly over">
                <p>
                  It ends on {formatMedium(end)}.{' '}
                  <a className="link" href="#/import">
                    Import the next roster
                  </a>{' '}
                  when it’s available.
                </p>
              </Callout>
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

          <div className="dash-side">
            <section className="card" aria-labelledby="schedule">
              <div className="card-head">
                <h2 id="schedule" className="card-title">
                  {formatMonthYear(y, m)}
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

            <section className="card roster-card" aria-labelledby="roster-title">
              <div className="roster-card-head">
                <span className="roster-card-icon" aria-hidden="true">
                  <FileIcon size={20} />
                </span>
                <div>
                  <h2 id="roster-title" className="card-title">
                    {roster.title ?? roster.fileName}
                  </h2>
                  <p className="muted">
                    {formatRange(start, end)} · imported {formatDayMonth(localDateOf(roster.importedAt))}
                    {ended && ' · ended'}
                  </p>
                </div>
              </div>
              <div className="roster-actions">
                <a className="btn btn-soft" href="#/import">
                  <UploadIcon size={18} /> Import newer roster
                </a>
                <a className="btn btn-soft" href="#/nurse">
                  <UserIcon size={18} /> Change name
                </a>
                <a className="btn btn-ghost" href="#/roster">
                  <SettingsIcon size={18} /> Roster details
                </a>
              </div>
            </section>
          </div>
        </div>

        <footer className="dash-foot">
          <PrivacyNote />
        </footer>
      </main>
    </>
  );
}
