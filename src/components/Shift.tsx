import { addDays, formatMedium, formatTime } from '../lib/dates';
import { toneOf } from '../lib/roster';
import type { Assignment, CodeDef } from '../lib/types';
import { ToneIcon } from './Icons';

type ShiftLike = Pick<Assignment, 'kind' | 'label' | 'code' | 'start' | 'end' | 'overnight'> & { raw?: string };

/** A shift label that never relies on colour alone: icon + code + text. */
export function ShiftChip({ a, size = 'md', showCode = true }: { a: ShiftLike; size?: 'sm' | 'md' | 'lg'; showCode?: boolean }) {
  const tone = toneOf(a);
  const code = a.kind === 'shift' || a.kind === 'off' ? a.code : undefined;
  return (
    <span className={`chip chip-${size} tone-${tone}`}>
      <ToneIcon tone={tone} size={size === 'lg' ? 22 : size === 'sm' ? 14 : 16} />
      {showCode && code && code !== a.label.toUpperCase() && <span className="chip-code">{code}</span>}
      <span className="chip-label">{a.label}</span>
    </span>
  );
}

export function timeRange(a: Pick<Assignment, 'start' | 'end'>): string {
  if (a.start && a.end) return `${formatTime(a.start)} – ${formatTime(a.end)}`;
  if (a.start) return `From ${formatTime(a.start)}`;
  if (a.end) return `Until ${formatTime(a.end)}`;
  return '';
}

/** "Continues into Sun 8 Nov" for overnight shifts. */
export function overnightNote(a: Pick<Assignment, 'date' | 'overnight' | 'kind'>): string {
  return a.kind === 'shift' && a.overnight ? `Ends the next morning, ${formatMedium(addDays(a.date, 1))}` : '';
}

export function CodeLegend({ codes }: { codes: CodeDef[] }) {
  return (
    <ul className="legend" aria-label="Shift codes used in this roster">
      {codes.map((c) => (
        <li key={c.key}>
          <ShiftChip a={{ kind: c.kind === 'unknown' ? 'unknown' : c.kind, label: c.label, code: c.key, overnight: c.overnight }} size="sm" />
          <span className="legend-meta">
            “{c.key}”{timeRange(c) ? ` · ${timeRange(c)}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
