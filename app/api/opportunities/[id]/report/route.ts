import { getSupabaseService } from "@/lib/db/client";
import { createClient } from "@/lib/db/server";
import { NextRequest, NextResponse } from "next/server";

const ISSUE_TYPES = new Set([
  "incorrect_information",
  "closed_or_expired",
  "wrong_eligibility",
  "broken_link",
  "other",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Opportunity id is required." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const issue_type = String(body?.issue_type ?? "incorrect_information");
    const description = body?.description != null ? String(body.description).slice(0, 1000) : null;

    if (!ISSUE_TYPES.has(issue_type)) {
      return NextResponse.json({ error: "Invalid issue_type." }, { status: 400 });
    }

    const service = getSupabaseService();

    const { data: opp, error: oppErr } = await service
      .from("opportunities")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (oppErr) return NextResponse.json({ error: oppErr.message }, { status: 500 });
    if (!opp) return NextResponse.json({ error: "Opportunity not found." }, { status: 404 });

    const { error: insErr } = await service.from("opportunity_issues").insert({
      opportunity_id: id,
      user_id: user.id,
      issue_type,
      description,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

