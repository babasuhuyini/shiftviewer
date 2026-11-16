import { useState } from 'react';
import { FEEDBACK_URL } from '../components/FeedbackPrompt';
import { analyticsEnabled, track } from '../lib/analytics';
import { updatePrefs } from '../lib/storage';
import { CheckIcon, ChevronRight, MonitorIcon, MoonIcon, SunIcon } from '../components/Icons';
import { PrivacyNote, TopBar } from '../components/ui';
import { APPEARANCES, PALETTES, type Appearance, type ThemeChoice } from '../lib/theme';

const APPEARANCE_ICON: Record<Appearance, typeof SunIcon> = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };
const APPEARANCE_HINT: Record<Appearance, string> = {
  light: 'Always light',
  dark: 'Always dark',
  system: 'Match this device',
};

export function Settings({
  theme,
  onChange,
  inShell,
}: {
  theme: ThemeChoice;
  onChange: (next: ThemeChoice) => void;
  /** False before a roster is imported: there is no navigation bar, so show a back button. */
  inShell: boolean;
}) {
  const [counts, setCounts] = useState(analyticsEnabled);
  return (
    <>
      <TopBar title="Settings" back={inShell ? undefined : { href: '#/', label: 'Back' }} />
      <main className="page page-narrow settings" id="main">
        <fieldset className="settings-group">
          <legend className="section-title first">Appearance</legend>
          <div className="option-row three">
            {APPEARANCES.map(({ id, name }) => {
              const Icon = APPEARANCE_ICON[id];
              return (
                <label key={id} className="option-card">
                  <input
                    type="radio"
                    name="appearance"
                    value={id}
                    checked={theme.appearance === id}
                    onChange={() => onChange({ ...theme, appearance: id })}
                  />
                  <span className="option-body">
                    <Icon size={22} />
                    <span className="option-name">{name}</span>
                    <span className="option-hint">{APPEARANCE_HINT[id]}</span>
                    <span className="option-check" aria-hidden="true">
                      <CheckIcon size={14} />
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="settings-group">
          <legend className="section-title">Colour palette</legend>
          <div className="option-row palettes">
            {PALETTES.map(({ id, name, description }) => (
              <label key={id} className="option-card palette-card">
                <input
                  type="radio"
                  name="palette"
                  value={id}
                  checked={theme.palette === id}
                  onChange={() => onChange({ ...theme, palette: id })}
                />
                <span className="option-body">
                  {/* The preview carries its own data-palette, so it shows that palette's real tokens. */}
                  <span className="palette-preview" data-palette={id} aria-hidden="true">
                    <span className="sw-surface">
                      <span className="sw-bar" />
                      <span className="sw-line" />
                      <span className="sw-line short" />
                    </span>
                    <span className="sw-dot" />
                  </span>
                  <span className="palette-text">
                    <span className="option-name">{name}</span>
                    <span className="option-hint">{description}</span>
                  </span>
                  <span className="option-check" aria-hidden="true">
                    <CheckIcon size={14} />
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="field-help">
            Shift types keep their own icons and labels in every palette, so morning, afternoon, night, off and leave stay easy to tell
            apart.
          </p>
        </fieldset>

        <p className="field-help settings-saved">
          Changes apply straight away and are saved on this device only. Removing a roster keeps these choices.
        </p>

        <section aria-labelledby="sends-title">
          <h2 id="sends-title" className="section-title">
            What this app sends
          </h2>
          <div className="card settings-card">
            <label className="check">
              <input
                type="checkbox"
                checked={counts}
                onChange={(e) => {
                  setCounts(e.target.checked);
                  updatePrefs({ analytics: e.target.checked });
                }}
              />
              <span>Share anonymous usage counts</span>
            </label>
            <p className="field-help">
              When on, the app tells a counting service (GoatCounter) that it was opened and whether an import worked. That is all:
              no roster, file name, staff name or shift is ever sent. No cookies are used. Like any website visit, the service sees
              your device’s internet address and browser type while counting.
            </p>
          </div>
        </section>

        <section aria-labelledby="feedback-title">
          <h2 id="feedback-title" className="section-title">
            Feedback
          </h2>
          <a className="card settings-link" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" onClick={() => track('feedback_opened')}>
            <span>
              <strong>Send feedback</strong>
              <span className="field-help">Opens a short form in a new tab. Please don’t include names or patient details.</span>
            </span>
            <ChevronRight size={18} />
          </a>
        </section>

        <PrivacyNote />
      </main>
    </>
  );
}
