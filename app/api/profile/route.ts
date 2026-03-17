import { getSupabaseService } from "@/lib/db/client";
import { createClient } from "@/lib/db/server";
import { scoreOpportunity } from "@/lib/scoring";
import type { OrgProfile, Opportunity } from "@/lib/scoring/types";
import { NextRequest, NextResponse } from "next/server";

function dbOrgToProfile(row: Record<string, unknown>): OrgProfile & { id: string } {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    org_type: (row.org_type ?? "other") as OrgProfile["org_type"],
    location_region: (row.location_region as string | null) ?? null,
    annual_income_band: (row.annual_income_band as string | null) ?? null,
    sectors: Array.isArray(row.sectors)
      ? (row.sectors as unknown[]).map(String)
      : typeof row.sectors === "object" && row.sectors
      ? Object.values(row.sectors as Record<string, unknown>).map(String)
      : [],
  };
}

function dbOppToScoring(row: Record<string, unknown>): Opportunity & { id: string } {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "Untitled"),
    source_id: (row.source_id as string) ?? undefined,
    funder_name: (row.funder_name as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    deadline: (row.deadline as string | null) ?? null,
    amount_text: (row.amount_text as string | null) ?? null,
    amount_min: row.amount_min != null ? Number(row.amount_min) : null,
    amount_max: row.amount_max != null ? Number(row.amount_max) : null,
    location_filters: (row.location_filters as Record<string, unknown>) ?? {},
    sector_filters: (row.sector_filters as Record<string, unknown>) ?? {},
    income_bands: (row.income_bands as Record<string, unknown>) ?? {},
    description: (row.description as string | null) ?? null,
    eligibility_summary: (row.eligibility_summary as string | null) ?? null,
  };
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

    const { data: link } = await supabase
      .from("user_organisations")
      .select("organisation_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!link?.organisation_id) {
      return NextResponse.json({ error: "No organisation found." }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      org_type,
      location_region,
      annual_income_band,
      sectors,
    }: {
      name?: string;
      org_type?: string;
      location_region?: string | null;
      annual_income_band?: string | null;
      sectors?: string[];
    } = body ?? {};

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }

    const validOrgTypes = ["vcse", "sme", "cic", "other"];
    const type = validOrgTypes.includes(org_type ?? "") ? org_type : "other";
    const sectorArray = Array.isArray(sectors) ? sectors.map(String) : [];

    const service = getSupabaseService();
    const { error: updateError } = await service
      .from("organisations")
      .update({
        name: name.trim(),
        org_type: type,
        location_region: location_region ?? null,
        annual_income_band: annual_income_band ?? null,
        sectors: sectorArray,
      })
      .eq("id", link.organisation_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Re-score all active opportunities for this org.
    const { data: orgRow, error: orgError } = await service
      .from("organisations")
      .select("id, name, org_type, location_region, annual_income_band, sectors")
      .eq("id", link.organisation_id)
      .single();

    if (orgError || !orgRow) {
      return NextResponse.json({ error: "Failed to load updated organisation." }, { status: 500 });
    }

    const orgProfile = dbOrgToProfile(orgRow as unknown as Record<string, unknown>);

    const { data: oppRows, error: oppError } = await service
      .from("opportunities")
      .select(
        "id, source_id, title, funder_name, url, deadline, amount_text, amount_min, amount_max, location_filters, sector_filters, income_bands, description, eligibility_summary, is_active"
      )
      .eq("is_active", true);

    if (oppError) {
      return NextResponse.json({ error: oppError.message }, { status: 500 });
    }

    const opps = (oppRows ?? [])
      .map((r) => r as unknown as Record<string, unknown>)
      .filter((r) => (r.source_id as string) !== "fts")
      .filter((r) => !String(r.title ?? "").toLowerCase().includes("360giving"));

    const computed_at = new Date().toISOString();
    const scoreRows = opps.map((o) => {
      const opp = dbOppToScoring(o);
      const result = scoreOpportunity(orgProfile, opp);
      return {
        organisation_id: link.organisation_id,
        opportunity_id: opp.id,
        fit_score: result.fit.fit_score,
        fit_breakdown: result.fit.fit_breakdown,
        ev: result.ev.expected_value,
        win_probability: result.ev.win_probability,
        bid_cost_estimate: result.ev.bid_cost_estimate,
        computed_at,
      };
    });

    const { error: upsertError } = await service.from("scores").upsert(scoreRows, {
      onConflict: "organisation_id,opportunity_id",
      ignoreDuplicates: false,
    });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rescored: scoreRows.length });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

