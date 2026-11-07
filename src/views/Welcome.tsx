import { CalendarIcon, HeartIcon, LockIcon, UploadIcon, UsersIcon } from '../components/Icons';
import { SettingsLink } from '../components/ui';
import { WelcomeMessage } from '../components/WelcomeMessage';

/** First run: nothing imported yet. One clear action, and an honest privacy note. */
export function Welcome() {
  return (
    <>
      <header className="welcome-bar">
        <SettingsLink />
      </header>
      <main className="page page-narrow welcome" id="main">
        <WelcomeMessage />
        <div className="welcome-hero">
          <span className="welcome-mark" aria-hidden="true">
            <HeartIcon size={28} />
          </span>
          <h1>My Shifts</h1>
          <p className="welcome-lead">Your department roster, made easy to read on your own device.</p>
          <a className="btn btn-primary btn-large" href="#/import">
            <UploadIcon size={20} /> Import a roster
          </a>
          <p className="welcome-privacy">
            <LockIcon size={16} />
            <span>The file is read in this browser and kept only on this device. Nothing is uploaded or shared.</span>
          </p>
        </div>

        <ul className="feature-list">
          <li>
            <CalendarIcon size={20} />
            <span>
              <strong>Your next shift, first.</strong> Upcoming shifts, days off and leave at a glance.
            </span>
          </li>
          <li>
            <UsersIcon size={20} />
            <span>
              <strong>Who’s on with you.</strong> Open any day to see colleagues on each shift.
            </span>
          </li>
        </ul>

        <p className="fine-print">
          This app only reads a roster. It can’t change the roster, assign shifts or approve swaps, and it never changes your
          original file.
        </p>
      </main>
    </>
  );
}
