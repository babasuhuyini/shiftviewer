import type { ReactNode } from 'react';
import { CalendarIcon, ClipboardIcon, GearIcon, HomeIcon, UsersIcon } from './Icons';

export type Tab = 'home' | 'schedule' | 'people' | 'roster';

const TABS: { id: Tab; label: string; href: string; Icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'Home', href: '#/', Icon: HomeIcon },
  { id: 'schedule', label: 'Schedule', href: '#/schedule', Icon: CalendarIcon },
  { id: 'people', label: 'People', href: '#/people', Icon: UsersIcon },
  { id: 'roster', label: 'Roster', href: '#/roster', Icon: ClipboardIcon },
];

function skipToContent() {
  const main = document.getElementById('main');
  if (main) {
    main.setAttribute('tabindex', '-1');
    main.focus();
  }
}

/**
 * App frame with the four primary destinations.
 * Phones: a bottom bar. Wider screens: a slim rail on the left, with Settings at its foot.
 * `current` is null on pages that sit outside the four tabs (Settings).
 */
export function Shell({ current, settingsActive, children }: { current: Tab | null; settingsActive?: boolean; children: ReactNode }) {
  return (
    <div className="shell">
      {/* A button, not a "#main" link: links change the hash route in this app. */}
      <button type="button" className="skip-link" onClick={skipToContent}>
        Skip to content
      </button>
      <nav className="app-nav" aria-label="Main">
        <span className="rail-mark brand-mark" aria-hidden="true" />
        <ul className="app-nav-list">
          {TABS.map(({ id, label, href, Icon }) => (
            <li key={id}>
              <a className="app-nav-item" href={href} aria-current={current === id ? 'page' : undefined}>
                <span className="app-nav-icon">
                  <Icon size={22} />
                </span>
                <span className="app-nav-label">{label}</span>
              </a>
            </li>
          ))}
        </ul>
        <a className="app-nav-item rail-settings" href="#/settings" aria-current={settingsActive ? 'page' : undefined}>
          <span className="app-nav-icon">
            <GearIcon size={22} />
          </span>
          <span className="app-nav-label">Settings</span>
        </a>
      </nav>
      <div className="shell-content">{children}</div>
    </div>
  );
}
