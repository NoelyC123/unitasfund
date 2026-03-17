import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import { buildMatchReasons } from "@/lib/scoring/fit";
import type { OrgProfile, Opportunity } from "@/lib/scoring/types";
import AddToPipelineButton from "./AddToPipelineButton";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const COMPONENT_MAX = 25;

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

function fitColour(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function componentBarColour(score: number): string {
  if (score >= 20) return "#22c55e";
  if (score >= 10) return "#f59e0b";
  return "#ef4444";
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

const COMPONENT_LABELS = ["Location", "Sector", "Income", "Deadline"] as const;

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

  const { data: scoreRow, error } = await supabase
    .from("scores")
    .select(
      `
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
    `
    )
    .eq("organisation_id", organisationId)
    .eq("opportunity_id", id)
    .maybeSingle();

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

  const matchReasons =
    orgProfile &&
    buildMatchReasons(orgProfile, opportunityForReasons, {
      location_score: fitBreakdown.location_score ?? 0,
      sector_score: fitBreakdown.sector_score ?? 0,
      income_score: fitBreakdown.income_score ?? 0,
      deadline_score: fitBreakdown.deadline_score ?? 0,
    });

  const scores = [
    fitBreakdown.location_score ?? 0,
    fitBreakdown.sector_score ?? 0,
    fitBreakdown.income_score ?? 0,
    fitBreakdown.deadline_score ?? 0,
  ];
  const reasons = matchReasons ?? [];

  const { data: existingPipeline } = await supabase
    .from("pipeline")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("opportunity_id", id)
    .limit(1)
    .maybeSingle();

  const applyUrl = (opp?.url as string | null) ?? null;
  const funderName = (opp?.funder_name as string | null) ?? null;
  const amountText = (opp?.amount_text as string | null) ?? null;
  const deadline = (opp?.deadline as string | null) ?? null;
  const description = (opp?.description as string | null) ?? null;
  const eligibilitySummary = (opp?.eligibility_summary as string | null) ?? null;

  return (
    <div className="pb-12">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <a href="/dashboard" className="text-sm hover:underline" style={{ color: GOLD }}>
          ← Back to dashboard
        </a>
        <AddToPipelineButton
          opportunityId={id}
          initiallyAdded={Boolean(existingPipeline?.id)}
        />
      </div>

      <div
        className="mt-5 rounded-xl border overflow-hidden"
        style={{ backgroundColor: "#fff", borderColor: "#ece6dd" }}
      >
        <div
          className="px-6 py-5 border-b"
          style={{ backgroundColor: NAVY, borderColor: "#2d3345" }}
        >
          <p
            className="text-xs font-semibold tracking-widest uppercase mb-2"
            style={{ color: GOLD }}
          >
            Opportunity
          </p>
          <h1 className="text-2xl font-bold" style={{ color: CREAM }}>
            {String(opp?.title ?? "Untitled")}
          </h1>
          {funderName && (
            <p className="mt-1 text-sm" style={{ color: "#a8b4c4" }}>
              {funderName}
            </p>
          )}
        </div>

        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className="rounded-lg border p-4"
                style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
                  Amount
                </p>
                <p className="mt-1 font-semibold" style={{ color: NAVY }}>
                  {amountText ?? "—"}
                </p>
              </div>
              <div
                className="rounded-lg border p-4"
                style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
                  Deadline
                </p>
                <p className="mt-1 font-semibold" style={{ color: NAVY }}>
                  {formatDeadline(deadline)}
                </p>
              </div>
              <div
                className="rounded-lg border p-4"
                style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
                  Fit score
                </p>
                <div className="mt-2">
                  <div
                    className="h-2.5 rounded-full overflow-hidden mb-1"
                    style={{ backgroundColor: "#e5e7eb" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, fitScore)}%`,
                        backgroundColor: fitColour(fitScore),
                      }}
                    />
                  </div>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: NAVY }}>
                    {Math.round(fitScore)}%
                  </p>
                </div>
              </div>
            </div>

            {applyUrl && (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                Apply now →
              </a>
            )}

            <div>
              <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
                Description
              </h2>
              <div
                className="rounded-lg border p-4 text-sm whitespace-pre-wrap"
                style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: "#374151" }}
              >
                {description?.trim() ? description : "No description available."}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
                Eligibility summary
              </h2>
              <div
                className="rounded-lg border p-4 text-sm whitespace-pre-wrap"
                style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: "#374151" }}
              >
                {eligibilitySummary?.trim()
                  ? eligibilitySummary
                  : "No eligibility summary available."}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div
              className="rounded-xl border p-5"
              style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5" }}
            >
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: GOLD }}>
                Why this score?
              </p>
              <div className="space-y-4 text-sm">
                {COMPONENT_LABELS.map((label, i) => {
                  const score = scores[i] ?? 0;
                  const reason = reasons[i] ?? "No detail available.";
                  const pct = Math.round((score / COMPONENT_MAX) * 100);
                  const barColor = componentBarColour(score);
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
                        <span className="tabular-nums" style={{ color: NAVY, fontWeight: 600 }}>
                          {Math.round(score)}/{COMPONENT_MAX}
                        </span>
                      </div>
                      <p style={{ color: NAVY, margin: 0 }}>{reason}</p>
                      <div
                        className="h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: "#e5e7eb" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="rounded-xl border p-5"
              style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}
            >
              <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: GOLD }}>
                Match reasons
              </p>
              <ul className="text-sm space-y-2" style={{ color: NAVY }}>
                {(reasons.length ? reasons : ["No match reasons available."]).map((r, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span style={{ color: GOLD }}>•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

