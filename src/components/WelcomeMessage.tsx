import { useState } from 'react';
import { greetingFor, pickMessage } from '../lib/messages';
import { CloseIcon, HeartIcon } from './Icons';

// Chosen once per page load (each open or refresh gets a new one).
let sessionMessage: string | null = null;
let dismissedThisSession = false;

function messageForSession(): string {
  if (sessionMessage === null) sessionMessage = pickMessage();
  return sessionMessage;
}

/** A small, warm note at the top of the screen. Never blocks anything below it. */
export function WelcomeMessage({ compact = false }: { compact?: boolean }) {
  const [hidden, setHidden] = useState(dismissedThisSession);
  if (hidden) return null;
  const message = messageForSession();
  const greeting = greetingFor(new Date().getHours());

  return (
    <aside className={`love-note${compact ? ' is-compact' : ''}`} aria-label="A note for you">
      <span className="love-note-icon" aria-hidden="true">
        <HeartIcon size={18} />
      </span>
      <div className="love-note-body">
        <p className="love-note-greeting">{greeting}</p>
        <p className="love-note-text">{message}</p>
      </div>
      <button
        type="button"
        className="love-note-close"
        aria-label="Hide this note"
        onClick={() => {
          dismissedThisSession = true;
          setHidden(true);
        }}
      >
        <CloseIcon size={16} />
      </button>
    </aside>
  );
}
