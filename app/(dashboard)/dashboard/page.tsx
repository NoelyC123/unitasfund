import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import OpportunityRow from "./OpportunityRow";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

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

  const { data: scoreRows, error } = await supabase
    .from("scores")
    .select(
      `
      id,
      opportunity_id,
      fit_score,
      fit_breakdown,
      ev,
      opportunities (
        id,
        source_id,
        title,
        funder_name,
        url,
        deadline,
        amount_text
      )
    `
    )
    .eq("organisation_id", organisationId)
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

  const allMapped = (scoreRows ?? []).map((row: Record<string, unknown>) => {
    const opp = row.opportunities as Record<string, unknown> | null;
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
    };
  });

  const grantsOnly = allMapped.filter((r) => r.source_id !== "fts");
  const totalMatched = grantsOnly.length;
  const topScore = grantsOnly[0]?.fit_score ?? 0;
  const opportunities = grantsOnly.slice(0, 20).map((r, i) => ({
    ...r,
    rank: i + 1,
  }));

  return (
    <div className="pb-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>
          {orgName}
        </h1>
        <p className="text-sm" style={{ color: "#4a5568" }}>
          {totalMatched === 0
            ? "No grant opportunities matched yet."
            : `${totalMatched} ${totalMatched === 1 ? "opportunity" : "opportunities"} matched. Top fit score: ${Math.round(topScore)}%.`}
        </p>
      </header>

      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: GOLD }}>
          Top matches
        </p>
        <h2 className="text-xl font-bold mb-1" style={{ color: NAVY }}>
          Grants (excluding tenders)
        </h2>
        <p className="text-sm" style={{ color: "#4a5568" }}>
          Ranked by fit score. Add to your pipeline to track applications.
        </p>
      </div>

      {opportunities.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "#fff", border: "1px solid #ece6dd" }}
        >
          <p className="mb-2" style={{ color: NAVY }}>
            No scored opportunities yet.
          </p>
          <p className="text-sm" style={{ color: "#4a5568" }}>
            Run the ingest script to load opportunities and compute scores.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((row) => (
            <OpportunityRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
