import { useState, useEffect } from 'react';
import RafflePage from './components/RafflePage';
import Login from './components/Login';
import Dashboard, { type UserProfile } from './components/Dashboard';
import UserPortal from './components/UserPortal';
import { supabase } from './lib/supabase';

function App() {
  const [session, setSession] = useState<any>(null);
  const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'raffle' | 'admin' | 'portal'>('raffle');

  const checkAdmin = async (currentSession: any) => {
    if (!currentSession) {
      setAdminProfile(null);
      setLoading(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('admin_profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single();

      if (profile) {
        setAdminProfile(profile);
      } else {
        // Bootstrap: Auto-promote the main owner if they log in
        if (currentSession.user.email === 'alejandrosuarezux@gmail.com') {
          const initialProfile: UserProfile = {
            id: currentSession.user.id,
            email: currentSession.user.email,
            role: 'superadmin',
            permissions: { raffles: true, participants: true, analytics: true, settings: true, admins: true }
          };
          
          const { error: insertError } = await supabase
            .from('admin_profiles')
            .insert([initialProfile])
            .select()
            .single();
            
          if (!insertError) {
            setAdminProfile(initialProfile);
          } else {
            console.error("Error bootstrapping initial admin:", insertError);
          }
        } else {
          // NOT AUTHORIZED - Force Logout
          console.warn("Unauthorized admin access attempt:", currentSession.user.email);
          await supabase.auth.signOut();
          setAdminProfile(null);
          setSession(null);
          // Show alert after logout to ensure they are on the login screen
          setTimeout(() => alert("Acceso denegado: Tu cuenta no tiene permisos de administrador."), 500);
        }
      }
    } catch (err) {
      console.error("Auth check error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdmin(session);
      } else {
        setLoading(false);
      }
    });

    // 1.5 Fetch global appearance settings
    const loadSettings = async () => {
      // Try to load cached settings first for instant rendering
      const cached = localStorage.getItem('platform_settings');
      if (cached) {
        try {
          const data = JSON.parse(cached);
          applyBranding(data);
        } catch (e) {
          console.error("Error parsing cached settings", e);
        }
      }

      const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
      if (data) {
        localStorage.setItem('platform_settings', JSON.stringify(data));
        applyBranding(data);
      }
    };

    const applyBranding = (data: any) => {
      if (data.primary_color) {
        document.documentElement.style.setProperty('--color-primary', data.primary_color);
        const hex = data.primary_color.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          document.documentElement.style.setProperty('--color-primary-glow', `rgba(${r}, ${g}, ${b}, 0.5)`);
        }
      }

      if (data.platform_name) {
        document.title = `${data.platform_name} | Sorteos`;
      }

      if (data.logo_url) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = data.logo_url;
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
      if (session) {
        checkAdmin(session);
      } else {
        setAdminProfile(null);
        setLoading(false);
      }
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

  if (view === 'admin') {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        </div>
      );
    }
    
    if (!session || !adminProfile) {
      return <Login onLogin={() => setView('admin')} />;
    }
    
    return <Dashboard userProfile={adminProfile} />;
  }

  return <RafflePage />;
}

export default App;
