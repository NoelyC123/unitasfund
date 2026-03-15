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
    const { opportunity_id } = body;
    if (!opportunity_id || typeof opportunity_id !== "string") {
      return NextResponse.json(
        { error: "opportunity_id is required." },
        { status: 400 }
      );
    }

    const { data: link } = await supabase
      .from("user_organisations")
      .select("organisation_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!link?.organisation_id) {
      return NextResponse.json(
        { error: "No organisation found for this user." },
        { status: 400 }
      );
    }

    const service = getSupabaseService();
    const { error } = await service.from("pipeline").upsert(
      {
        organisation_id: link.organisation_id,
        opportunity_id,
        status: "interested",
      },
      { onConflict: "organisation_id,opportunity_id" }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to add to pipeline." },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
