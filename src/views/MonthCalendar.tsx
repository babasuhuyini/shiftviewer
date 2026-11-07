import { CodeLegend } from '../components/Shift';
import { ToneIcon } from '../components/Icons';
import { formatLong, formatMonthYear, monthMatrix, monthsBetween, WEEKDAYS, WEEKDAYS_SHORT } from '../lib/dates';
import { assignmentsOn, shortMark, toneOf } from '../lib/roster';
import type { Assignment, Person, Roster } from '../lib/types';

function describe(list: Assignment[]): string {
  if (!list.length) return 'not listed';
  return list
    .map((a) => (a.kind === 'unknown' ? `unrecognised entry “${a.raw}”` : a.label))
    .join(' and ');
}

export function MonthCalendar({ roster, me, today }: { roster: Roster; me: Person; today: string }) {
  const months = monthsBetween(roster.period.start, roster.period.end);
  // Week starts on Sunday, matching common hospital rosters.
  const weekStart = 0;
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

  return (
    <div className="calendar">
      {months.map(({ y, m }) => (
        <div key={`${y}-${m}`} className="cal-month">
          {months.length > 1 && <h3 className="cal-title">{formatMonthYear(y, m)}</h3>}
          <table className="cal-grid">
            <caption className="visually-hidden">Your shifts in {formatMonthYear(y, m)}</caption>
            <thead>
              <tr>
                {order.map((d) => (
                  <th key={d} scope="col" abbr={WEEKDAYS[d]}>
                    {WEEKDAYS_SHORT[d].slice(0, 1)}
                    <span className="cal-wd-rest">{WEEKDAYS_SHORT[d].slice(1)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthMatrix(y, m, weekStart).map((week, wi) => (
                <tr key={wi}>
                  {week.map((date, di) => {
                    if (!date) return <td key={di} className="cal-pad" />;
                    const inRange = date >= roster.period.start && date <= roster.period.end;
                    const list = inRange ? assignmentsOn(roster, me.id, date) : [];
                    const first = list[0];
                    const tone = first ? toneOf(first) : 'none';
                    const day = Number(date.slice(8));
                    return (
                      <td key={di}>
                        {inRange ? (
                          <a
                            href={`#/day/${date}`}
                            className={`cal-cell tone-${tone}${date === today ? ' is-today' : ''}${date < today ? ' is-past' : ''}`}
                            aria-label={`${formatLong(date)}${date === today ? ' (today)' : ''}: ${describe(list)}`}
                          >
                            <span className="cal-day">{day}</span>
                            {first && (
                              <span className="cal-mark">
                                <ToneIcon tone={toneOf(first)} size={12} />
                                <span className="cal-text">{shortMark(first)}</span>
                                {list.length > 1 && <span className="cal-more">+{list.length - 1}</span>}
                              </span>
                            )}
                          </a>
                        ) : (
                          <span className="cal-cell is-outside" aria-hidden="true">
                            <span className="cal-day">{day}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <CodeLegend codes={roster.codes} />
    </div>
  );
}
