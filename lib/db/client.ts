/**
 * Supabase client for UnitasFund (and any engine scripts that need DB access).
 * Uses environment variables — never hardcode keys.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase URL or anon key missing. Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_*)."
  );
}

/**
 * Browser/safe client: use anon key and RLS.
 * For server-side or scripts, use getSupabaseService() with SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 */
export function getSupabase(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Service role client: bypasses RLS. Use only on the server (e.g. ingest scripts, API routes).
 * Requires env: SUPABASE_SERVICE_ROLE_KEY
 */
export function getSupabaseService(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service role client.");
  }
  return createClient(supabaseUrl, serviceKey);
}

export default getSupabase;
