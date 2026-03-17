import { getSupabaseService } from "@/lib/db/client";
import { createClient } from "@/lib/db/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await request.json();
    const enabled = Boolean(body?.enabled ?? true);

    const { data: link } = await supabase
      .from("user_organisations")
      .select("organisation_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!link?.organisation_id) {
      return NextResponse.json({ error: "No organisation found." }, { status: 400 });
    }

    const service = getSupabaseService();
    const { error } = await service
      .from("organisations")
      .update({ user_alerts_enabled: enabled })
      .eq("id", link.organisation_id);

    if (error) {
      return NextResponse.json({ error: error.message ?? "Failed to subscribe." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, enabled });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

