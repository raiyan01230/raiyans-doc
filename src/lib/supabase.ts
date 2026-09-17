import { createClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

export function initSupabaseClient(url: string, anonKey: string): SupabaseClient {
  if (clientInstance) return clientInstance;

  clientInstance = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });

  return clientInstance;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  // Check client-side environment variables if injected
  const envUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey && envUrl !== 'https://your-project.supabase.co' && envKey !== 'your-anon-key') {
    return initSupabaseClient(envUrl, envKey);
  }

  return null;
}
