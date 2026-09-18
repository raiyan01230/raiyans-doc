import React, { useState, useEffect } from 'react';
import { api, setAuthToken, getStoredAuthToken } from './lib/api';
import { initSupabaseClient } from './lib/supabase';
import { UserSession, ServerConfig } from './types';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { SetupGuideModal } from './components/SetupGuideModal';

export default function App() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);

  useEffect(() => {
    async function initApp() {
      try {
        // Fetch server configuration
        const config = await api.getServerConfig();
        setServerConfig(config);

        const token = getStoredAuthToken();

        // If Supabase is configured on server, initialize client SDK with public URL & anon key
        if (config.isSupabaseConfigured && config.supabaseUrl && config.supabaseAnonKey) {
          const supabase = initSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);

          // Check existing Supabase session
          const { data } = await supabase.auth.getSession();
          if (data.session && data.session.user) {
            setAuthToken(data.session.access_token);
            setUserSession({
              id: data.session.user.id,
              email: data.session.user.email || 'raiyan3945@gmail.com',
              token: data.session.access_token,
              created_at: data.session.user.created_at,
            });
          }

          // Listen to auth state transitions
          supabase.auth.onAuthStateChange((_event, session) => {
            if (session && session.user) {
              setAuthToken(session.access_token);
              setUserSession({
                id: session.user.id,
                email: session.user.email || 'raiyan3945@gmail.com',
                token: session.access_token,
                created_at: session.user.created_at,
              });
            } else {
              setAuthToken(null);
              setUserSession(null);
            }
          });
        } else {
          // Standard session mode
          if (token) {
            const rawIdentifier = decodeURIComponent(token.replace('demo-token-', ''));
            const isEmail = rawIdentifier.includes('@');
            setUserSession({
              id: '00000000-0000-0000-0000-000000000001',
              username: isEmail ? rawIdentifier.split('@')[0] : 'raiyan',
              email: isEmail ? rawIdentifier : 'raiyan3945@gmail.com',
              token: token,
            });
          }
        }
      } catch (err) {
        console.error('Applet initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    }

    initApp();
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    setUserSession(null);
  };

  // Full-screen minimal loader during initial session check
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-neutral-400 font-mono text-xs">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-200 rounded-full animate-spin mb-3"></div>
        <span>CHECKING SECURE SESSION...</span>
      </div>
    );
  }

  return (
    <>
      {userSession ? (
        <Dashboard
          userSession={userSession}
          serverConfig={serverConfig}
          onLogout={handleLogout}
          onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
        />
      ) : (
        <LoginPage
          serverConfig={serverConfig}
          onLoginSuccess={(session) => setUserSession(session)}
          onOpenSetupGuide={() => setIsSetupGuideOpen(true)}
        />
      )}

      <SetupGuideModal
        isOpen={isSetupGuideOpen}
        onClose={() => setIsSetupGuideOpen(false)}
        isConfigured={Boolean(serverConfig?.isSupabaseConfigured)}
      />
    </>
  );
}
