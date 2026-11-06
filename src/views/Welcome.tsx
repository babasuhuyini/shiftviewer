import { CalendarIcon, HeartIcon, LockIcon, SwapIcon, UploadIcon, UsersIcon } from '../components/Icons';
import { WelcomeMessage } from '../components/WelcomeMessage';

export function Welcome() {
  return (
    <main className="page page-narrow welcome" id="main">
      <WelcomeMessage />
      <div className="welcome-hero">
        <span className="welcome-mark" aria-hidden="true">
          <HeartIcon size={30} />
        </span>
        <h1>My Shifts</h1>
        <p className="welcome-lead">Your department roster, made easy to read — on your own device.</p>
        <a className="btn btn-primary btn-large" href="#/import">
          <UploadIcon size={20} /> Import a roster
        </a>
      </div>

      <ul className="feature-list">
        <li>
          <CalendarIcon size={20} />
          <div>
            <strong>Your next shift, first</strong>
            <span>See your upcoming shifts, days off and leave at a glance.</span>
          </div>
        </li>
        <li>
          <UsersIcon size={20} />
          <div>
            <strong>Who’s on with you</strong>
            <span>Open any day to see colleagues on each shift.</span>
          </div>
        </li>
        <li>
          <SwapIcon size={20} />
          <div>
            <strong>Find someone to ask about a swap</strong>
            <span>For information only — swaps are still arranged and approved by your unit.</span>
          </div>
        </li>
        <li>
          <LockIcon size={20} />
          <div>
            <strong>Private by design</strong>
            <span>The file is read in your browser and kept only on this device. Nothing is uploaded or shared.</span>
          </div>
        </li>
      </ul>

      <p className="fine-print">
        This app only reads a roster. It can’t change the roster, assign shifts or approve swaps, and it never changes your
        original file.
      </p>
    </main>
  );
}
