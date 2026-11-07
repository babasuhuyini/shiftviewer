import { useState } from 'react';
import { ChevronRight } from '../components/Icons';
import { ShiftChip, timeRange } from '../components/Shift';
import { addDays, formatLong, formatMonthYear, parseISO, WEEKDAYS_SHORT, weekdayOf } from '../lib/dates';
import { assignmentsOn, colleaguesOn } from '../lib/roster';
import type { ISODate, Person, Roster } from '../lib/types';

export function Agenda({ roster, me, today }: { roster: Roster; me: Person; today: string }) {
  const [showPast, setShowPast] = useState(false);
  const { start, end } = roster.period;
  const from = showPast || today < start ? start : today > end ? start : today;
  const days: ISODate[] = [];
  for (let d = from; d <= end; d = addDays(d, 1)) days.push(d);
  const hasPast = from > start;

  let lastMonth = '';
  return (
    <div className="agenda">
      {hasPast && (
        <button type="button" className="btn btn-small btn-ghost agenda-past" onClick={() => setShowPast(true)}>
          Show earlier days
        </button>
      )}
      <ul className="agenda-list">
        {days.map((date) => {
          const list = assignmentsOn(roster, me.id, date);
          const { y, m } = parseISO(date);
          const monthKey = `${y}-${m}`;
          const header = monthKey !== lastMonth ? formatMonthYear(y, m) : null;
          lastMonth = monthKey;
          const shift = list.find((a) => a.kind === 'shift');
          const others = shift ? colleaguesOn(roster, me, shift).length : 0;
          return (
            <li key={date}>
              {header && <h3 className="agenda-month">{header}</h3>}
              <a href={`#/day/${date}`} className={`agenda-row${date === today ? ' is-today' : ''}${date < today ? ' is-past' : ''}`}>
                <span className="date-block" aria-hidden="true">
                  <span className="db-wd">{WEEKDAYS_SHORT[weekdayOf(date)]}</span>
                  <span className="db-d">{Number(date.slice(8))}</span>
                </span>
                <span className="agenda-main">
                  <span className="visually-hidden">{formatLong(date)}{date === today ? ' (today)' : ''}: </span>
                  {list.length ? list.map((a, i) => <ShiftChip key={i} a={a} size="sm" />) : <span className="muted">Not listed</span>}
                  <span className="agenda-sub">
                    {date === today && <strong>Today</strong>}
                    {shift && timeRange(shift) && <span>{timeRange(shift)}</span>}
                    {shift && <span>{others ? `with ${others} ${others === 1 ? 'colleague' : 'colleagues'}` : 'no one else listed'}</span>}
                    {list.some((a) => a.kind === 'unknown') && <span className="warn-text">check official roster</span>}
                  </span>
                </span>
                <ChevronRight size={18} />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
