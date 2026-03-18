import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import { buildMatchReasons } from "@/lib/scoring/fit";
import type { OrgProfile, Opportunity } from "@/lib/scoring/types";
import DashboardClient from "./DashboardClient";
import { getSupabaseService } from "@/lib/db/client";
import type { PlanId } from "@/lib/stripe/plans";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

export const metadata = {
  title: "Dashboard | UnitasFund",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userOrg } = await supabase
    .from("user_organisations")
    .select("organisation_id, organisations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const organisationId = userOrg?.organisation_id ?? null;
  const orgName = (userOrg as { organisations?: { name: string } } | null)
    ?.organisations?.name ?? "Your organisation";

  if (!organisationId) {
    return (
      <div className="rounded-xl p-8" style={{ backgroundColor: "#fff", border: "1px solid #ece6dd" }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>
          Dashboard
        </h1>
        <p className="mb-4" style={{ color: "#4a5568" }}>
          You don&apos;t have an organisation yet. Complete your profile first.
        </p>
        <a
          href="/onboarding"
          className="inline-block px-4 py-2 rounded-lg font-semibold"
          style={{ backgroundColor: GOLD, color: CREAM }}
        >
          Set up organisation profile
        </a>
      </div>
    );
  }

  const service = getSupabaseService();
  const [{ data: subRow }, { count: pipelineCount }] = await Promise.all([
    service
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
    service
      .from("pipeline")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId),
  ]);

  const { data: orgRow } = await supabase
    .from("organisations")
    .select("id, name, org_type, location_region, annual_income_band, sectors")
    .eq("id", organisationId)
    .single();

  const orgProfile: OrgProfile | null = orgRow
    ? {
        id: orgRow.id,
        name: String(orgRow.name ?? ""),
        org_type: (orgRow.org_type ?? "other") as OrgProfile["org_type"],
        location_region: orgRow.location_region ?? null,
        annual_income_band: orgRow.annual_income_band ?? null,
        sectors: Array.isArray(orgRow.sectors)
          ? (orgRow.sectors as string[]).map(String)
          : typeof orgRow.sectors === "object" && orgRow.sectors
          ? Object.values(orgRow.sectors).map(String)
          : [],
      }
    : null;

  const profileIncomplete =
    !orgProfile ||
    !orgProfile.location_region ||
    !orgProfile.annual_income_band ||
    (orgProfile.sectors?.length ?? 0) === 0;

  const { data: scoreRows, error } = await supabase
    .from("scores")
    .select(
      `
      id,
      opportunity_id,
      fit_score,
      fit_breakdown,
      ev,
      eligibility_certainty,
      opportunities!inner (
        id,
        source_id,
        title,
        funder_name,
        url,
        deadline,
        amount_text,
        amount_min,
        amount_max,
        last_checked_at,
        location_filters,
        sector_filters,
        income_bands,
        description,
        eligibility_summary,
        is_active
      )
    `
    )
    .eq("organisation_id", organisationId)
    .eq("opportunities.is_active", true)
    .order("fit_score", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <div className="rounded-xl p-8" style={{ backgroundColor: "#fff", border: "1px solid #ece6dd" }}>
        <h1 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>
          Dashboard
        </h1>
        <p className="text-red-600">Error loading opportunities: {error.message}</p>
      </div>
    );
  }

  const breakdownFromRow = (b: unknown): { location_score?: number; sector_score?: number; income_score?: number; deadline_score?: number } => {
    if (!b || typeof b !== "object") return {};
    const o = b as Record<string, number>;
    return {
      location_score: o.location_score,
      sector_score: o.sector_score,
      income_score: o.income_score,
      deadline_score: o.deadline_score,
    };
  };

  const allMapped = (scoreRows ?? []).map((row: Record<string, unknown>) => {
    const opp = row.opportunities as Record<string, unknown> | null;
    const fit_breakdown = breakdownFromRow(row.fit_breakdown);
    const opportunityForReasons: Opportunity = {
      id: String(opp?.id ?? row.opportunity_id),
      title: String(opp?.title ?? "Untitled"),
      source_id: (opp?.source_id as string) ?? undefined,
      funder_name: (opp?.funder_name as string) ?? null,
      url: (opp?.url as string) ?? null,
      deadline: (opp?.deadline as string) ?? null,
      amount_text: (opp?.amount_text as string) ?? null,
      amount_min: opp?.amount_min != null ? Number(opp.amount_min) : null,
      amount_max: opp?.amount_max != null ? Number(opp.amount_max) : null,
      location_filters: (opp?.location_filters as Record<string, unknown>) ?? {},
      sector_filters: (opp?.sector_filters as Record<string, unknown>) ?? {},
      income_bands: (opp?.income_bands as Record<string, unknown>) ?? {},
      description: (opp?.description as string) ?? null,
      eligibility_summary: (opp?.eligibility_summary as string) ?? null,
    };
    const match_reasons =
      orgProfile &&
      buildMatchReasons(orgProfile, opportunityForReasons, {
        location_score: fit_breakdown.location_score ?? 0,
        sector_score: fit_breakdown.sector_score ?? 0,
        income_score: fit_breakdown.income_score ?? 0,
        deadline_score: fit_breakdown.deadline_score ?? 0,
      });

    return {
      id: (opp?.id ?? row.opportunity_id) as string,
      source_id: (opp?.source_id ?? null) as string | null,
      title: (opp?.title ?? "Untitled") as string,
      funder_name: (opp?.funder_name ?? null) as string | null,
      url: (opp?.url ?? null) as string | null,
      fit_score: Number(row.fit_score ?? 0),
      fit_breakdown: (row.fit_breakdown ?? null) as Record<string, number> | null,
      ev: row.ev != null ? Number(row.ev) : null,
      deadline: (opp?.deadline ?? null) as string | null,
      amount_text: (opp?.amount_text ?? null) as string | null,
      is_active: opp?.is_active !== false,
      last_checked_at: (opp?.last_checked_at ?? null) as string | null,
      match_reasons: match_reasons ?? [],
      eligibility_certainty: (row.eligibility_certainty ?? null) as string | null,
    };
  });

  const grantsOnly = allMapped.filter(
    (r) =>
      r.source_id !== "fts" &&
      r.is_active &&
      !(r.title ?? "").toLowerCase().includes("360giving")
  );

  console.log("[Dashboard] Scores fetched:", scoreRows?.length ?? 0);
  console.log(
    "[Dashboard] After filters (active, non-FTS, no 360Giving):",
    grantsOnly.length
  );

  return (
    <DashboardClient
      orgName={orgName}
      rows={grantsOnly}
      profileIncomplete={profileIncomplete}
      plan={((subRow as any)?.plan as PlanId) ?? "free"}
      pipelineCount={pipelineCount ?? 0}
    />
  );
}
