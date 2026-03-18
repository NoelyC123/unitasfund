import { getSupabaseService } from "@/lib/db/client";
import { createClient } from "@/lib/db/server";
import { NextRequest, NextResponse } from "next/server";

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "organisation";
}

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
    const {
      name,
      org_type,
      location_region,
      annual_income_band,
      sectors,
      funding_goals,
    } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Organisation name is required." },
        { status: 400 }
      );
    }

    const slug = slugFromName(name);
    const validOrgTypes = ["vcse", "sme", "cic", "other"];
    const type = validOrgTypes.includes(org_type) ? org_type : "other";
    const sectorArray = Array.isArray(sectors) ? sectors : [];

    const insertPayload = {
      name: name.trim(),
      slug,
      org_type: type,
      location_region: location_region ?? null,
      annual_income_band: annual_income_band ?? null,
      sectors: sectorArray,
      funding_goals: funding_goals ?? null,
      created_by: user.id,
    };

    const serviceSupabase = getSupabaseService();
    const { data: org, error } = await serviceSupabase
      .from("organisations")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "An organisation with this name already exists. Try a different name." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message ?? "Failed to save organisation." },
        { status: 500 }
      );
    }

    const { error: linkError } = await serviceSupabase
      .from("user_organisations")
      .insert({
        user_id: user.id,
        organisation_id: org.id,
        role: "owner",
        is_default: true,
      });

    if (linkError) {
      return NextResponse.json(
        { error: linkError.message ?? "Failed to link user to organisation." },
        { status: 500 }
      );
    }

    return NextResponse.json(org);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
