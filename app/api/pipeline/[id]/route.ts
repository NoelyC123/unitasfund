import { getSupabaseService } from "@/lib/db/client";
import { createClient } from "@/lib/db/server";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATUSES = [
  "interested",
  "applying",
  "submitted",
  "won",
  "lost",
] as const;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Pipeline row id is required." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status } = body;
    if (
      !status ||
      typeof status !== "string" ||
      !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])
    ) {
      return NextResponse.json(
        { error: "Valid status is required (interested, applying, submitted, won, lost)." },
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
    const { data: row, error: fetchError } = await service
      .from("pipeline")
      .select("id, organisation_id")
      .eq("id", id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json(
        { error: "Pipeline entry not found." },
        { status: 404 }
      );
    }

    if (row.organisation_id !== link.organisation_id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const { error: updateError } = await service
      .from("pipeline")
      .update({ status })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message ?? "Failed to update status." },
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
