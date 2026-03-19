import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";

/**
 * Auth callback for Supabase email links (e.g. password reset, magic link).
 * Exchanges the `code` query param for a session and redirects to /reset-password.
 * Supabase redirect URL in dashboard must include: https://your-domain/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";

  if (!code) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "missing_code");
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "callback_failed");
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
