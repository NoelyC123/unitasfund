/**
 * Supabase browser client for Client Components (auth, realtime).
 * Uses cookies for session; pair with server client for SSR.
 */

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
