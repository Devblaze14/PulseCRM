import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Single Supabase client for the whole app. Sessions are persisted to
// localStorage and refreshed automatically, so a reload keeps the user signed in.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Login is optional (guests can use the whole app), so a missing Supabase config
// must NOT crash the app at import time — that would blank the page on first
// paint. Instead we warn and expose a null client; auth features no-op until the
// env vars are set (e.g. in the Vercel project settings).
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "Supabase is not configured (missing VITE_SUPABASE_URL or " +
      "VITE_SUPABASE_ANON_KEY). Running in guest-only mode — sign in / register " +
      "is disabled until these env vars are set.",
  );
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
