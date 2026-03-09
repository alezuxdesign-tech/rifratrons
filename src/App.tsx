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

    // 1.5 Fetch global appearance settings
    const loadSettings = async () => {
      const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
      if (data && data.primary_color) {
        document.documentElement.style.setProperty('--color-primary', data.primary_color);
        const hex = data.primary_color.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          document.documentElement.style.setProperty('--color-primary-glow', `rgba(${r}, ${g}, ${b}, 0.5)`);
        }
      }
    };

    loadSettings();

    // 1.6 Listen for settings changes in real-time
    const settingsSubscription = supabase.channel('public:platform_settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, () => {
        loadSettings();
      })
      .subscribe();

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

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(settingsSubscription);
    };
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
