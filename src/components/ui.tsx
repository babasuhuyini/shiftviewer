import { useEffect, useRef, type ReactNode } from 'react';
import { AlertIcon, ChevronLeft, InfoIcon, LockIcon } from './Icons';

export function TopBar({ title, back, right }: { title: ReactNode; back?: { href: string; label: string }; right?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        {back ? (
          <a className="icon-btn" href={back.href} aria-label={back.label}>
            <ChevronLeft size={22} />
          </a>
        ) : (
          <span className="brand-mark" aria-hidden="true" />
        )}
        <h1 className="topbar-title">{title}</h1>
        <div className="topbar-right">{right}</div>
      </div>
    </header>
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
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
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
