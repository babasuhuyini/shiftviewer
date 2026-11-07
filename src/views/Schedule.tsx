import { useState } from 'react';
import { CalendarIcon, ListIcon } from '../components/Icons';
import { ShiftChip } from '../components/Shift';
import { Callout, Segmented, SettingsLink, TopBar } from '../components/ui';
import { formatDayMonth, formatMonthYear, formatRange, monthsBetween, relativeLabel, todayISO } from '../lib/dates';
import { rangesOf } from '../lib/roster';
import { getPrefs, updatePrefs } from '../lib/storage';
import type { Person, Roster } from '../lib/types';
import { Agenda } from './Agenda';
import { MonthCalendar } from './MonthCalendar';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Schedule({ roster, me }: { roster: Roster; me: Person }) {
  const today = todayISO();
  const [view, setView] = useState<'calendar' | 'agenda'>(() => getPrefs().view ?? 'calendar');
  const { start, end } = roster.period;
  const ended = today > end;
  const ahead = (roster.entries[me.id] ?? []).filter((a) => a.date >= today);
  const offRanges = rangesOf(ahead.filter((a) => a.kind === 'off' || a.kind === 'leave'));
  const unknownAhead = ahead.filter((a) => a.kind === 'unknown');
  const months = monthsBetween(start, end);
  const heading = months.length === 1 ? formatMonthYear(months[0].y, months[0].m) : formatRange(start, end);

  const left = {
    shifts: ahead.filter((a) => a.kind === 'shift').length,
    off: new Set(ahead.filter((a) => a.kind === 'off').map((a) => a.date)).size,
    leave: new Set(ahead.filter((a) => a.kind === 'leave').map((a) => a.date)).size,
  };

  return (
    <>
      <TopBar title="Schedule" right={<SettingsLink inShell />} />
      <main className="page schedule" id="main">
        <div className="schedule-head">
          <div>
            <h2 className="page-heading">{heading}</h2>
            {!ended ? (
              <p className="muted schedule-summary">
                Still to come: {plural(left.shifts, 'shift', 'shifts')} · {plural(left.off, 'day off', 'days off')} ·{' '}
                {plural(left.leave, 'leave day', 'leave days')}
              </p>
            ) : (
              <p className="muted schedule-summary">This roster has ended.</p>
            )}
          </div>
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

        {unknownAhead.length > 0 && (
          <Callout tone="warning" title="Some entries need checking">
            <p>
              {plural(unknownAhead.length, 'upcoming day has', 'upcoming days have')} an entry the app couldn’t interpret (
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

        <div className="schedule-grid">
          <section className="schedule-main" aria-label={view === 'calendar' ? 'Month calendar' : 'Day-by-day list'}>
            {view === 'calendar' ? <MonthCalendar roster={roster} me={me} today={today} /> : <Agenda roster={roster} me={me} today={today} />}
          </section>

          <section className="schedule-side" aria-labelledby="days-off">
            <h2 id="days-off" className="section-title">
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
      </main>
    </>
  );
}
