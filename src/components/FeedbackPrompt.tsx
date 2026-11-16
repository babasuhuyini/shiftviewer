import { useEffect, useState } from 'react';
import { track } from '../lib/analytics';
import { todayISO, diffDays } from '../lib/dates';
import { getPrefs, updatePrefs } from '../lib/storage';

/*
 * Feedback goes to a Tally form that opens in a new tab. The app itself sends nothing:
 * no rating, no text, no roster data. Whatever someone types is sent by Tally's page.
 */
export const FEEDBACK_URL = 'https://tally.so/r/laOaM6';

const MIN_OPENS = 3;
const DAYS_BETWEEN = 30;

// Once shown in a session, keep it until answered — but don't re-ask for DAYS_BETWEEN days.
let shownThisSession = false;

/** Count one "use" per page load (called once when a roster is open). */
export function noteAppOpened(): void {
  const f = getPrefs().feedback ?? {};
  updatePrefs({ feedback: { ...f, opens: (f.opens ?? 0) + 1 } });
}

function due(): boolean {
  const f = getPrefs().feedback ?? {};
  if (f.done || f.never || (f.opens ?? 0) < MIN_OPENS) return false;
  return !f.lastPrompt || diffDays(f.lastPrompt, todayISO()) >= DAYS_BETWEEN;
}

const save = (patch: { done?: boolean; never?: boolean }) => updatePrefs({ feedback: { ...(getPrefs().feedback ?? {}), ...patch } });

/** A small, occasional question on Home only. Never shown during import or on other screens. */
export function FeedbackPrompt() {
  const [visible, setVisible] = useState(() => shownThisSession || due());

  useEffect(() => {
    if (visible && !shownThisSession) {
      shownThisSession = true;
      updatePrefs({ feedback: { ...(getPrefs().feedback ?? {}), lastPrompt: todayISO() } });
      track('feedback_prompt_shown');
    }
  }, [visible]);

  if (!visible) return null;
  const close = (patch: { done?: boolean; never?: boolean } = {}) => {
    save(patch);
    shownThisSession = false;
    setVisible(false);
  };

  return (
    <aside className="feedback-prompt" aria-labelledby="feedback-title">
      <p id="feedback-title" className="feedback-title">
        How is My Shifts working for you?
      </p>
      <p className="feedback-text">
        A short form opens in a new tab. It doesn’t ask for your name, and nothing from your roster is sent. Please don’t include
        names or patient details.
      </p>
      <div className="feedback-actions">
        <a
          className="btn btn-primary btn-small"
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            track('feedback_opened');
            close({ done: true });
          }}
        >
          Give feedback
        </a>
        <button type="button" className="btn btn-small" onClick={() => close()}>
          Not now
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={() => close({ never: true })}>
          Don’t ask again
        </button>
      </div>
    </aside>
  );
}
