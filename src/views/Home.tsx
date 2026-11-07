import { AvatarStack } from '../components/Avatar';
import { ChevronRight, ClockIcon, ToneIcon, UploadIcon, UsersIcon } from '../components/Icons';
import { overnightNote, ShiftChip, timeRange } from '../components/Shift';
import { Callout, SettingsLink, TopBar } from '../components/ui';
import { WelcomeMessage } from '../components/WelcomeMessage';
import { addDays, diffDays, formatDayMonth, formatLong, formatMedium, formatRange, MONTHS, parseISO, relativeLabel, todayISO, WEEKDAYS, WEEKDAYS_SHORT, weekdayOf } from '../lib/dates';
import { assignmentsOn, colleaguesOn, shortMark, toneOf } from '../lib/roster';
import type { ISODate, Person, Roster } from '../lib/types';

function namesText(people: Person[]): string {
  const names = people.map((p) => p.name);
  if (names.length <= 3) return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** Home answers one question first: when is my next shift? */
export function Home({ roster, me }: { roster: Roster; me: Person }) {
  const today = todayISO();
  const { start, end } = roster.period;
  const ended = today > end;
  const notStarted = today < start;
  const endsSoon = !ended && diffDays(today, end) <= 5;
  const ahead = (roster.entries[me.id] ?? []).filter((a) => a.date >= today);
  const next = ahead.find((a) => a.kind === 'shift');
  const colleagues = next ? colleaguesOn(roster, me, next) : [];

  // Seven days from today (or from the roster start if it hasn't begun).
  const stripStart: ISODate = notStarted ? start : today;
  const week: ISODate[] = ended ? [] : Array.from({ length: 7 }, (_, i) => addDays(stripStart, i));
  const unknownThisWeek = week.flatMap((d) => assignmentsOn(roster, me.id, d)).filter((a) => a.kind === 'unknown');

  return (
    <>
      <TopBar title="My Shifts" brand right={<SettingsLink inShell />} />
      <main className="page page-narrow home" id="main">
        <WelcomeMessage />

        <p className="viewing">
          <span className="muted">Shifts for</span> <strong>{me.name}</strong>
          <a className="link viewing-change" href="#/nurse">
            Change
          </a>
        </p>

        {notStarted && (
          <Callout tone="info">
            <p>This roster starts on {formatLong(start)}.</p>
          </Callout>
        )}

        {next ? (
          <section className="next-shift" aria-labelledby="next-shift-label">
            <div className="next-top">
              <h2 className="eyebrow" id="next-shift-label">
                Next shift
              </h2>
              <span className="pill">{relativeLabel(next.date, today)}</span>
            </div>
            <p className="next-date">
              <span className="next-weekday">{WEEKDAYS[weekdayOf(next.date)]}</span>
              <span>
                {Number(next.date.slice(8))} {MONTHS[parseISO(next.date).m - 1]}
              </span>
            </p>
            <div className="next-detail">
              <ShiftChip a={next} size="lg" />
              {timeRange(next) && (
                <p className="next-time">
                  <ClockIcon size={18} />
                  {timeRange(next)}
                </p>
              )}
            </div>
            {overnightNote(next) && <p className="next-note">{overnightNote(next)}</p>}
            <div className="next-team">
              {colleagues.length ? (
                <>
                  <AvatarStack names={colleagues.map((p) => p.name)} />
                  <p>
                    <span className="muted">With </span>
                    {namesText(colleagues)}
                  </p>
                </>
              ) : (
                <>
                  <UsersIcon size={18} />
                  <p className="muted">No one else is listed on this shift.</p>
                </>
              )}
            </div>
            <a className="next-link" href={`#/day/${next.date}`}>
              See everyone working this day <ChevronRight size={18} />
            </a>
          </section>
        ) : (
          <section className="next-shift is-empty" aria-labelledby="no-shift">
            <h2 className="eyebrow">Next shift</h2>
            <p className="next-empty-title" id="no-shift">
              {ended ? 'This roster has ended' : 'No more shifts in this roster'}
            </p>
            <p className="muted">
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
          <section className="home-section" aria-labelledby="week-title">
            <div className="section-head">
              <h2 id="week-title" className="section-title">
                {notStarted ? 'First week' : 'Next 7 days'}
              </h2>
              <a className="link section-link" href="#/schedule">
                Full schedule <ChevronRight size={16} />
              </a>
            </div>
            <ol className="week-strip">
              {week.map((date) => {
                const inRange = date >= start && date <= end;
                const list = inRange ? assignmentsOn(roster, me.id, date) : [];
                const first = list[0];
                const tone = first ? toneOf(first) : 'none';
                const desc = !inRange
                  ? 'outside this roster'
                  : first
                    ? list.map((a) => (a.kind === 'unknown' ? `unrecognised “${a.raw}”` : a.label)).join(' and ')
                    : 'not listed';
                const isToday = date === today;
                return (
                  <li key={date}>
                    {inRange ? (
                      <a
                        href={`#/day/${date}`}
                        className={`week-day tone-${tone}${isToday ? ' is-today' : ''}`}
                        aria-label={`${formatLong(date)}${isToday ? ' (today)' : ''}: ${desc}`}
                      >
                        <span className="wd-name">{isToday ? 'Today' : WEEKDAYS_SHORT[weekdayOf(date)]}</span>
                        <span className="wd-num">{Number(date.slice(8))}</span>
                        <span className="wd-mark">
                          {first ? (
                            <>
                              <ToneIcon tone={toneOf(first)} size={13} />
                              <span>{shortMark(first)}</span>
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

        {unknownThisWeek.length > 0 && (
          <Callout tone="warning" title="Check the official roster">
            <p>
              {unknownThisWeek.length === 1 ? 'One day' : `${unknownThisWeek.length} days`} this week{' '}
              {unknownThisWeek.length === 1 ? 'has an entry' : 'have entries'} the app couldn’t interpret (
              {unknownThisWeek.map((a, i) => (
                <span key={a.date}>
                  {i > 0 && ', '}
                  <a className="link" href={`#/day/${a.date}`}>
                    {formatDayMonth(a.date)}: “{a.raw}”
                  </a>
                </span>
              ))}
              ).
            </p>
          </Callout>
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
      </main>
    </>
  );
}
