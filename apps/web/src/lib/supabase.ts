import { createClient } from "@supabase/supabase-js";

/**
 * ADR-008: Supabase Auth is the identity provider (same pattern as
 * apps/mobile/src/lib/supabase.ts). The publishable/anon key is safe to
 * embed in a browser app; apps/api's own server-side JWT verification
 * (SupabaseAuthAdapter) is what actually authorizes requests, not this key.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar definidos (veja apps/web/.env.example).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
