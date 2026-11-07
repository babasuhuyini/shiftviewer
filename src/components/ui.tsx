import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { AlertIcon, ChevronLeft, GearIcon, InfoIcon, LockIcon } from './Icons';

export function TopBar({
  title,
  back,
  right,
  brand,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  right?: ReactNode;
  /** Show the small app mark before the title (Home and first run). */
  brand?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        {back ? (
          <a className="icon-btn" href={back.href} aria-label={back.label}>
            <ChevronLeft size={22} />
          </a>
        ) : brand ? (
          <span className="brand-mark" aria-hidden="true" />
        ) : null}
        <h1 className="topbar-title">{title}</h1>
        <div className="topbar-right">{right}</div>
      </div>
    </header>
  );
}

/**
 * Gear button for Settings. With `inShell`, it is hidden on wide screens where the
 * side navigation already has a Settings entry.
 */
export function SettingsLink({ inShell = false }: { inShell?: boolean }) {
  return (
    <a className={`icon-btn${inShell ? ' hide-with-rail' : ''}`} href="#/settings" aria-label="Settings">
      <GearIcon size={22} />
    </a>
  );
}

export function Callout({ tone = 'info', title, children }: { tone?: 'info' | 'warning' | 'error' | 'privacy'; title?: ReactNode; children?: ReactNode }) {
  const Icon = tone === 'privacy' ? LockIcon : tone === 'info' ? InfoIcon : AlertIcon;
  return (
    <div className={`callout callout-${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon size={20} />
      <div>
        {title && <p className="callout-title">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); onCancel(); }} aria-labelledby="dialog-title">
      <h2 id="dialog-title">{title}</h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  // Radio-group keyboard pattern: one tab stop, arrow keys move and select.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>('button');
    buttons[options.indexOf(next)]?.focus();
  };
  return (
    <div className="segmented" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value || (value === null && i === 0) ? 0 : -1}
          className={value === o.value ? 'is-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function PrivacyNote() {
  return (
    <p className="privacy-note">
      <LockIcon size={14} /> Your roster is read and kept only on this device. Nothing is uploaded.
    </p>
  );
}
