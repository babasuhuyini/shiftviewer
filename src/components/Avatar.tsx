/** Initials in a soft circle. Decorative only — the full name is always shown nearby. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function hue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 5;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`avatar avatar-${size} avatar-h${hue(name)}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="avatar-stack" aria-hidden="true">
      {shown.map((n) => (
        <Avatar key={n} name={n} size="sm" />
      ))}
      {extra > 0 && <span className="avatar avatar-sm avatar-more">+{extra}</span>}
    </span>
  );
}
