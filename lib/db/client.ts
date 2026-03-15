/**
 * Supabase client for UnitasFund (and any engine scripts that need DB access).
 * Uses environment variables — never hardcode keys.
 * URL/keys are read when the getter is called so scripts that load .env first (e.g. ingest) work.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function getSupabaseAnonKey(): string {
  return process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

/**
 * Browser/safe client: use anon key and RLS.
 * For server-side or scripts, use getSupabaseService() with SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 */
export function getSupabase(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    console.warn(
      "Supabase URL or anon key missing. Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_*)."
    );
  }
  return createClient(url, key);
}

/**
 * Service role client: bypasses RLS. Use only on the server (e.g. ingest scripts, API routes).
 * Requires env: SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 */
export function getSupabaseService(): SupabaseClient {
  const url = getSupabaseUrl();
  if (!url) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for service role client.");
  }
  return createClient(url, serviceKey);
}

export default getSupabase;
