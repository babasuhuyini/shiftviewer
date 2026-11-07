import { useCallback, useEffect, useRef, useState } from 'react';
import { Shell, type Tab } from './components/Shell';
import { Spinner } from './components/ui';
import { ImportWizard } from './import/ImportWizard';
import { findSelected, toSelected } from './lib/roster';
import { clearRoster, getPrefs, loadRoster, saveRoster, updatePrefs } from './lib/storage';
import { applyTheme, normaliseTheme, watchSystemMode, type ThemeChoice } from './lib/theme';
import type { Person, Roster, SelectedNurse } from './lib/types';
import { DayView } from './views/DayView';
import { Home } from './views/Home';
import { NursePicker } from './views/NursePicker';
import { People, PersonView } from './views/People';
import { RosterInfo } from './views/RosterInfo';
import { Schedule } from './views/Schedule';
import { Settings } from './views/Settings';
import { Welcome } from './views/Welcome';

type Route =
  | { name: 'home' }
  | { name: 'schedule' }
  | { name: 'people' }
  | { name: 'person'; id: string }
  | { name: 'roster' }
  | { name: 'settings' }
  | { name: 'import' }
  | { name: 'nurse' }
  | { name: 'day'; date: string };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const day = /^day\/(\d{4}-\d{2}-\d{2})$/.exec(h);
  if (day) return { name: 'day', date: day[1] };
  const person = /^person\/(.+)$/.exec(h);
  if (person) {
    try {
      return { name: 'person', id: decodeURIComponent(person[1]) };
    } catch {
      return { name: 'people' };
    }
  }
  if (h === 'import' || h === 'nurse' || h === 'roster' || h === 'schedule' || h === 'people' || h === 'settings') return { name: h };
  return { name: 'home' };
}

/** Which bottom-bar / rail tab a route belongs to. */
function tabOf(route: Route): Tab | null {
  switch (route.name) {
    case 'home':
    case 'schedule':
    case 'people':
    case 'roster':
      return route.name;
    case 'person':
      return 'people';
    default:
      return null;
  }
}

const TAB_BACK: Record<Tab, { href: string; label: string }> = {
  home: { href: '#/', label: 'Back to Home' },
  schedule: { href: '#/schedule', label: 'Back to Schedule' },
  people: { href: '#/people', label: 'Back to People' },
  roster: { href: '#/roster', label: 'Back to Roster' },
};

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Appearance and palette: applied immediately, saved with the other local preferences. */
function useTheme(): [ThemeChoice, (t: ThemeChoice) => void] {
  const [theme, setTheme] = useState<ThemeChoice>(() => normaliseTheme(getPrefs()));
  useEffect(() => {
    applyTheme(theme);
    if (theme.appearance !== 'system') return;
    return watchSystemMode(() => applyTheme(theme));
  }, [theme]);
  const update = useCallback((t: ThemeChoice) => {
    updatePrefs({ appearance: t.appearance, palette: t.palette });
    setTheme(t);
  }, []);
  return [theme, update];
}

export const navigate = (path: string) => {
  window.location.hash = path;
};

export function App() {
  const route = useRoute();
  const [theme, setTheme] = useTheme();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedNurse | undefined>(() => getPrefs().nurse);
  // The day view's back button returns to the tab it was opened from.
  const lastTab = useRef<Tab>('home');
  const tab = tabOf(route);
  useEffect(() => {
    if (tab) lastTab.current = tab;
  }, [tab]);

  useEffect(() => {
    loadRoster().then((r) => {
      setRoster(r);
      setLoading(false);
    });
  }, []);

  const me: Person | null = roster ? findSelected(roster, selected) : null;

  const pickNurse = useCallback((p: Person) => {
    const sel = toSelected(p);
    updatePrefs({ nurse: sel });
    setSelected(sel);
    navigate('/');
  }, []);

  const accept = useCallback(async (r: Roster) => {
    await saveRoster(r);
    setRoster(r);
    navigate('/nurse');
  }, []);

  const remove = useCallback(async () => {
    await clearRoster();
    setRoster(null);
    setSelected(undefined);
    navigate('/');
  }, []);

  if (loading) {
    return (
      <main className="page center-page">
        <Spinner label="Opening your roster…" />
      </main>
    );
  }

  if (route.name === 'import') {
    return <ImportWizard existing={roster} onCancel={() => navigate('/')} onAccept={accept} />;
  }

  // Settings is reachable before a roster is imported (and while choosing a name).
  if (route.name === 'settings' && !(roster && me)) {
    return <Settings theme={theme} onChange={setTheme} inShell={false} />;
  }

  if (!roster) return <Welcome />;

  if (route.name === 'nurse' || !me) {
    return <NursePicker roster={roster} current={me} previous={selected} onPick={pickNurse} />;
  }

  let page;
  switch (route.name) {
    case 'schedule':
      page = <Schedule roster={roster} me={me} />;
      break;
    case 'people':
      page = <People roster={roster} me={me} />;
      break;
    case 'person':
      page = <PersonView key={route.id} roster={roster} me={me} id={route.id} />;
      break;
    case 'roster':
      page = <RosterInfo roster={roster} me={me} onRemove={remove} />;
      break;
    case 'settings':
      page = <Settings theme={theme} onChange={setTheme} inShell />;
      break;
    case 'day':
      page = <DayView roster={roster} me={me} date={route.date} back={TAB_BACK[lastTab.current]} />;
      break;
    default:
      page = <Home roster={roster} me={me} />;
  }

  return (
    <Shell current={route.name === 'day' ? lastTab.current : tab} settingsActive={route.name === 'settings'}>
      {page}
    </Shell>
  );
}
