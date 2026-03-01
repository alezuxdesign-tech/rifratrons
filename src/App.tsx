import { useState, useEffect } from 'react';
import RafflePage from './components/RafflePage';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import UserPortal from './components/UserPortal';
import { supabase } from './lib/supabase';

function App() {
  const [session, setSession] = useState<any>(null);
  const [view, setView] = useState<'raffle' | 'admin' | 'portal'>('raffle');

  useEffect(() => {
    // 1. Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Simple URL-based routing for MVP
    const path = window.location.pathname;
    if (path === '/admin') {
      setView('admin');
    } else if (path === '/mis-tickets') {
      setView('portal');
    } else {
      setView('raffle');
    }

    return () => subscription.unsubscribe();
  }, []);

  if (view === 'portal') {
    return <UserPortal />;
  }

  if (view === 'admin' && !session) {
    return <Login onLogin={() => setView('admin')} />;
  }

  return view === 'admin' ? <Dashboard /> : <RafflePage />;
}

export default App;
