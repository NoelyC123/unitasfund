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

function clampNotes(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.slice(0, 1000);
  return t;
}

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
    const nextStatus = body?.status;
    const nextNotes = body?.notes;
    const update: Record<string, unknown> = {};

    if (nextStatus != null) {
      if (
        typeof nextStatus !== "string" ||
        !VALID_STATUSES.includes(nextStatus as (typeof VALID_STATUSES)[number])
      ) {
        return NextResponse.json(
          { error: "Valid status is required (interested, applying, submitted, won, lost)." },
          { status: 400 }
        );
      }
      update.status = nextStatus;
    }

    if (nextNotes != null) {
      update.notes = clampNotes(nextNotes);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
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
      .update(update)
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
