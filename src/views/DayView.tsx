import { Avatar } from '../components/Avatar';
import { Callout, TopBar } from '../components/ui';
import { ChevronLeft, ChevronRight, SwapIcon } from '../components/Icons';
import { overnightNote, ShiftChip, timeRange } from '../components/Shift';
import { addDays, formatLong, formatMedium, relativeLabel, todayISO } from '../lib/dates';
import { assignmentsOn, duplicateNames, groupsOn, personLabel, type DayGroup } from '../lib/roster';
import type { Person, Roster } from '../lib/types';

export function DayView({ roster, me, date }: { roster: Roster; me: Person; date: string }) {
  const today = todayISO();
  const { start, end } = roster.period;
  const inRange = date >= start && date <= end;
  const groups = inRange ? groupsOn(roster, date) : [];
  const mine = inRange ? assignmentsOn(roster, me.id, date) : [];
  const dupes = duplicateNames(roster);
  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  const isMine = (g: DayGroup) => g.people.some((p) => p.person.id === me.id);
  const shiftGroups = groups.filter((g) => g.kind === 'shift');
  const myShiftGroups = shiftGroups.filter(isMine);
  const otherShiftGroups = shiftGroups.filter((g) => !isMine(g));
  const restGroups = groups.filter((g) => g.kind !== 'shift');

  return (
    <>
      <TopBar title={formatMedium(date)} back={{ href: '#/', label: 'Back to my shifts' }} />
      <main className="page page-narrow day" id="main">
        <nav className="day-nav" aria-label="Change day">
          {prev >= start ? (
            <a className="icon-btn" href={`#/day/${prev}`} aria-label={`Previous day, ${formatMedium(prev)}`}>
              <ChevronLeft size={22} />
            </a>
          ) : (
            <span className="icon-btn is-disabled" aria-hidden="true">
              <ChevronLeft size={22} />
            </span>
          )}
          <div className="day-nav-title">
            <h2>{formatLong(date)}</h2>
            <span className="muted">{relativeLabel(date, today)}</span>
          </div>
          {next <= end ? (
            <a className="icon-btn" href={`#/day/${next}`} aria-label={`Next day, ${formatMedium(next)}`}>
              <ChevronRight size={22} />
            </a>
          ) : (
            <span className="icon-btn is-disabled" aria-hidden="true">
              <ChevronRight size={22} />
            </span>
          )}
        </nav>

        {!inRange ? (
          <Callout tone="info">
            <p>This date is outside the imported roster ({formatMedium(start)} – {formatMedium(end)}).</p>
          </Callout>
        ) : (
          <>
            <section className="card you-card" aria-labelledby="your-day">
              <h2 id="your-day" className="card-title">
                Your day
              </h2>
              {mine.length ? (
                mine.map((a, i) => (
                  <div key={i} className="you-line">
                    <ShiftChip a={a} size="lg" />
                    {timeRange(a) && <span className="you-time">{timeRange(a)}</span>}
                    {overnightNote(a) && <span className="muted">{overnightNote(a)}</span>}
                    {a.kind === 'unknown' && (
                      <Callout tone="warning">
                        <p>
                          The roster says <code className="raw">{a.raw || '(blank)'}</code> here, which the app couldn’t
                          interpret. Check the official roster.
                        </p>
                      </Callout>
                    )}
                    {a.kind === 'unassigned' && <span className="muted">Your cell on the roster is empty.</span>}
                  </div>
                ))
              ) : (
                <p className="muted">You’re not listed on this date.</p>
              )}
            </section>

            {myShiftGroups.map((g) => (
              <GroupCard key={g.key} group={g} me={me} dupes={dupes} heading="On your shift" highlight />
            ))}

            {otherShiftGroups.length > 0 && (
              <>
                <h2 className="section-title">{myShiftGroups.length ? 'Other shifts on this day' : 'Shifts on this day'}</h2>
                <Callout tone="info" title="For information only">
                  <p>
                    <SwapIcon size={14} /> Seeing a colleague on another shift doesn’t mean they are available or allowed to
                    swap. Any swap must be agreed with them and approved through your unit’s usual process — this app can’t
                    request or approve swaps.
                  </p>
                </Callout>
                {otherShiftGroups.map((g) => (
                  <GroupCard key={g.key} group={g} me={me} dupes={dupes} />
                ))}
              </>
            )}

            {restGroups.length > 0 && (
              <section className="rest-groups" aria-label="Not on a shift">
                {restGroups.map((g) => (
                  <details key={g.key} className="rest-group" open={g.kind === 'unknown'}>
                    <summary>
                      <ShiftChip a={{ kind: g.kind, label: restLabel(g) }} size="sm" showCode={false} />
                      <span className="muted">
                        {g.people.length} {g.people.length === 1 ? 'person' : 'people'}
                      </span>
                    </summary>
                    <PeopleList group={g} me={me} dupes={dupes} showRaw={g.kind === 'unknown'} />
                  </details>
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

function restLabel(g: DayGroup): string {
  if (g.kind === 'unknown') return `Not recognised: “${g.people[0]?.a.raw || 'blank'}”`;
  return g.label;
}

function GroupCard({ group, me, dupes, heading, highlight }: { group: DayGroup; me: Person; dupes: Set<string>; heading?: string; highlight?: boolean }) {
  return (
    <section className={`card group-card${highlight ? ' is-mine' : ''}`} aria-label={`${group.label}${heading ? ` (${heading})` : ''}`}>
      {heading && <p className="group-eyebrow">{heading}</p>}
      <div className="group-head">
        <ShiftChip a={group} />
        <span className="group-meta">
          {timeRange(group) && <span>{timeRange(group)}</span>}
          <span>
            {group.people.length} {group.people.length === 1 ? 'person' : 'people'}
          </span>
        </span>
      </div>
      <PeopleList group={group} me={me} dupes={dupes} />
    </section>
  );
}

function PeopleList({ group, me, dupes, showRaw }: { group: DayGroup; me: Person; dupes: Set<string>; showRaw?: boolean }) {
  const sorted = [...group.people].sort((a, b) => (a.person.id === me.id ? -1 : b.person.id === me.id ? 1 : a.person.name.localeCompare(b.person.name)));
  return (
    <ul className="people">
      {sorted.map(({ person, a }) => (
        <li key={person.id} className={person.id === me.id ? 'is-me' : ''}>
          <span className="people-name">
            <Avatar name={person.name} size="sm" />
            {person.name}
            {person.id === me.id && <span className="you-badge">You</span>}
          </span>
          <span className="people-meta">
            {personLabel(person, dupes)}
            {showRaw && <code className="raw">{a.raw || '(blank)'}</code>}
          </span>
        </li>
      ))}
    </ul>
  );
}
