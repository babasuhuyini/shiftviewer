import { useCallback, useEffect, useState } from 'react';
import { Spinner } from './components/ui';
import { ImportWizard } from './import/ImportWizard';
import { findSelected, toSelected } from './lib/roster';
import { clearRoster, getPrefs, loadRoster, saveRoster, updatePrefs } from './lib/storage';
import type { Person, Roster, SelectedNurse } from './lib/types';
import { Dashboard } from './views/Dashboard';
import { DayView } from './views/DayView';
import { NursePicker } from './views/NursePicker';
import { RosterInfo } from './views/RosterInfo';
import { Welcome } from './views/Welcome';

type Route = { name: 'home' } | { name: 'import' } | { name: 'nurse' } | { name: 'roster' } | { name: 'day'; date: string };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  const day = /^day\/(\d{4}-\d{2}-\d{2})$/.exec(h);
  if (day) return { name: 'day', date: day[1] };
  if (h === 'import') return { name: 'import' };
  if (h === 'nurse') return { name: 'nurse' };
  if (h === 'roster') return { name: 'roster' };
  return { name: 'home' };
}

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

export const navigate = (path: string) => {
  window.location.hash = path;
};

export function App() {
  const route = useRoute();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedNurse | undefined>(() => getPrefs().nurse);

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
  if (!roster) return <Welcome />;

  if (route.name === 'nurse' || !me) {
    return <NursePicker roster={roster} current={me} previous={selected} onPick={pickNurse} />;
  }
  if (route.name === 'roster') return <RosterInfo roster={roster} me={me} onRemove={remove} />;
  if (route.name === 'day') return <DayView roster={roster} me={me} date={route.date} />;
  return <Dashboard roster={roster} me={me} />;
}
