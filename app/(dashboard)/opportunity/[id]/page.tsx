import { createClient } from "@/lib/db/server";
import { getSupabaseService } from "@/lib/db/client";
import { redirect } from "next/navigation";
import { buildMatchReasons } from "@/lib/scoring/fit";
import type { OrgProfile, Opportunity } from "@/lib/scoring/types";
import OpportunityDetailClient from "./OpportunityDetailClient";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const COMPONENT_MAX = 25;

function clampDescription(s: string | null, max: number): string | null {
  if (!s) return null;
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return null;
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function formatDeadline(d: string | null): string {
  if (!d || !d.trim()) return "Rolling";
  const date = new Date(d.trim());
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function deadlineBadge(deadline: string | null): { label: string; bg: string; text: string } {
  if (!deadline || !deadline.trim()) {
    return { label: "Rolling", bg: "#e0f2fe", text: "#075985" };
  }
  const d = new Date(deadline.trim());
  const t = d.getTime();
  if (Number.isNaN(t)) {
    return { label: deadline, bg: "#e5e7eb", text: "#374151" };
  }
  const now = Date.now();
  const diffDays = (t - now) / (1000 * 60 * 60 * 24);
  if (diffDays < 14) return { label: formatDeadline(deadline), bg: "#fee2e2", text: "#991b1b" };
  if (diffDays < 28) return { label: formatDeadline(deadline), bg: "#fef3c7", text: "#92400e" };
  return { label: formatDeadline(deadline), bg: "#dcfce7", text: "#166534" };
}

function breakdownFromRow(
  b: unknown
): { location_score?: number; sector_score?: number; income_score?: number; deadline_score?: number } {
  if (!b || typeof b !== "object") return {};
  const o = b as Record<string, number>;
  return {
    location_score: o.location_score,
    sector_score: o.sector_score,
    income_score: o.income_score,
    deadline_score: o.deadline_score,
  };
}

async function fetchScoreRowWithOptionalReasons(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organisationId: string;
  opportunityId: string;
}) {
  const baseSelect = `
    id,
    opportunity_id,
    fit_score,
    fit_breakdown,
    ev,
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
      location_filters,
      sector_filters,
      income_bands,
      description,
      eligibility_summary,
      is_active
    )
  `;

  const withReasons = `
    ${baseSelect},
    match_reasons
  `;

  const attempt = await args.supabase
    .from("scores")
    .select(withReasons)
    .eq("organisation_id", args.organisationId)
    .eq("opportunity_id", args.opportunityId)
    .maybeSingle();

  if (!attempt.error) return attempt;

  const msg = (attempt.error as { message?: string } | null)?.message ?? "";
  if (msg.toLowerCase().includes("match_reasons") && msg.toLowerCase().includes("does not exist")) {
    return await args.supabase
      .from("scores")
      .select(baseSelect)
      .eq("organisation_id", args.organisationId)
      .eq("opportunity_id", args.opportunityId)
      .maybeSingle();
  }

  return attempt;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<{ title: string; description?: string }> {
  const { id } = await params;
  try {
    const service = getSupabaseService();
    const { data } = await service
      .from("opportunities")
      .select("title, description, eligibility_summary")
      .eq("id", id)
      .maybeSingle();
    const title = (data?.title as string | undefined) ?? "Opportunity";
    const desc =
      clampDescription((data?.eligibility_summary as string | null) ?? null, 160) ??
      clampDescription((data?.description as string | null) ?? null, 160) ??
      undefined;
    return { title: `${title} | UnitasFund`, description: desc };
  } catch {
    return { title: "Opportunity | UnitasFund" };
  }
}

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: link } = await supabase
    .from("user_organisations")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const organisationId = link?.organisation_id ?? null;
  if (!organisationId) redirect("/onboarding");

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

  const scoreRes = await fetchScoreRowWithOptionalReasons({
    supabase,
    organisationId,
    opportunityId: id,
  });

  const scoreRow = scoreRes.data as any;
  const error = scoreRes.error as any;

  if (error || !scoreRow) {
    return (
      <div
        className="rounded-xl p-8"
        style={{ backgroundColor: "#fff", border: "1px solid #ece6dd" }}
      >
        <a href="/dashboard" className="text-sm hover:underline" style={{ color: GOLD }}>
          ← Back to dashboard
        </a>
        <h1 className="text-2xl font-bold mt-4" style={{ color: NAVY }}>
          Opportunity not found
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#4a5568" }}>
          This opportunity may not be scored for your organisation yet.
        </p>
      </div>
    );
  }

  const opp = scoreRow.opportunities as unknown as Record<string, unknown>;
  const fitScore = Number(scoreRow.fit_score ?? 0);
  const fitBreakdown = breakdownFromRow(scoreRow.fit_breakdown);
  const ev = scoreRow.ev != null ? Number(scoreRow.ev) : null;

  const opportunityForReasons: Opportunity = {
    id: String(opp?.id ?? id),
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

  const computedMatchReasons =
    orgProfile &&
    buildMatchReasons(orgProfile, opportunityForReasons, {
      location_score: fitBreakdown.location_score ?? 0,
      sector_score: fitBreakdown.sector_score ?? 0,
      income_score: fitBreakdown.income_score ?? 0,
      deadline_score: fitBreakdown.deadline_score ?? 0,
    });

  const reasonsFromDb = Array.isArray(scoreRow.match_reasons)
    ? (scoreRow.match_reasons as unknown[]).map(String).filter(Boolean)
    : null;
  const reasons = reasonsFromDb ?? computedMatchReasons ?? [];

  const { data: existingPipeline } = await supabase
    .from("pipeline")
    .select("id, status, notes")
    .eq("organisation_id", organisationId)
    .eq("opportunity_id", id)
    .limit(1)
    .maybeSingle();

  const similarRes = await supabase
    .from("scores")
    .select(
      `
      opportunity_id,
      fit_score,
      opportunities!inner (
        id,
        title,
        funder_name,
        deadline,
        is_active
      )
    `
    )
    .eq("organisation_id", organisationId)
    .neq("opportunity_id", id)
    .eq("opportunities.is_active", true)
    .order("fit_score", { ascending: false })
    .limit(3);

  const similar = (similarRes.data ?? []).map((r: any) => ({
    opportunity_id: String(r.opportunity_id ?? r.opportunities?.id ?? ""),
    fit_score: Number(r.fit_score ?? 0),
    title: String(r.opportunities?.title ?? "Untitled"),
    funder_name: (r.opportunities?.funder_name as string | null) ?? null,
    deadline: (r.opportunities?.deadline as string | null) ?? null,
  }));

  return (
    <OpportunityDetailClient
      organisationId={organisationId}
      opportunityId={id}
      title={String(opp?.title ?? "Untitled")}
      funder_name={(opp?.funder_name as string | null) ?? null}
      url={(opp?.url as string | null) ?? null}
      description={(opp?.description as string | null) ?? null}
      eligibility_summary={(opp?.eligibility_summary as string | null) ?? null}
      deadline={(opp?.deadline as string | null) ?? null}
      amount_text={(opp?.amount_text as string | null) ?? null}
      amount_min={opp?.amount_min != null ? Number(opp.amount_min) : null}
      amount_max={opp?.amount_max != null ? Number(opp.amount_max) : null}
      fit_score={fitScore}
      fit_breakdown={fitBreakdown}
      ev={ev}
      match_reasons={reasons}
      initialPipeline={
        existingPipeline?.id
          ? {
              id: String(existingPipeline.id),
              status: String(existingPipeline.status ?? "interested") as any,
              notes: (existingPipeline.notes as string | null) ?? "",
            }
          : null
      }
      similar={similar.filter((s) => Boolean(s.opportunity_id))}
    />
  );
}

