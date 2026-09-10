import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase is optional. The app is local-first and fully usable offline; this
 * only powers backup and the Claude-backed food estimator.
 *
 * The app holds the project URL and the anon key, both of which are public by
 * design. The Anthropic key lives only as a Supabase secret, read by the
 * estimate-food Edge Function — it must never be bundled here.
 */

type Extra = { supabaseUrl?: string | null; supabaseAnonKey?: string | null };

function config(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

export function isConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = config();
  return Boolean(supabaseUrl && supabaseAnonKey);
}

let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (!isConfigured()) return null;
  if (client) return client;

  const { supabaseUrl, supabaseAnonKey } = config();
  client = createClient(supabaseUrl as string, supabaseAnonKey as string, {
    auth: {
      // Single-user app with no accounts: nothing to persist or refresh.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return client;
}
