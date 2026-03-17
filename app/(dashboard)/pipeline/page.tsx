import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import PipelineTable from "./PipelineTable";

const NAVY = "#1a1f2e";

export const metadata = {
  title: "Pipeline | UnitasFund",
};

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: userOrg } = await supabase
    .from("user_organisations")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  const organisationId = userOrg?.organisation_id ?? null;
  if (!organisationId) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm p-8">
          <h1 className="text-2xl font-bold text-[#1a1f2e] mb-2">Pipeline</h1>
          <p className="mb-6 text-[#6b7280]">
            You need an organisation profile before you can use the pipeline.
          </p>
          <a
            href="/onboarding"
            className="inline-block px-6 py-2.5 bg-[#c9923a] text-white font-medium rounded-lg text-sm hover:opacity-90 transition-opacity shadow-sm"
          >
            Set up organisation profile →
          </a>
        </div>
      </div>
    );
  }

  const { data: pipelineRows, error } = await supabase
    .from("pipeline")
    .select(
      `
      id,
      status,
      notes,
      actual_award_amount,
      bid_hours_estimate,
      loss_reason,
      outcome_notes,
      opportunities (
        id,
        title,
        funder_name,
        url,
        deadline,
        amount_text
      )
    `
    )
    .eq("organisation_id", organisationId)
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm p-8">
          <h1 className="text-2xl font-bold text-[#1a1f2e] mb-2">Pipeline</h1>
          <p className="text-red-600">Error loading pipeline: {error.message}</p>
        </div>
      </div>
    );
  }

  const items = (pipelineRows ?? []).map((row: Record<string, unknown>) => {
    const opp = row.opportunities as Record<string, unknown> | null;
    return {
      id: row.id as string,
      status: row.status as string,
      notes: (row.notes as string) ?? "",
      actual_award_amount: (row.actual_award_amount as number | null) ?? null,
      bid_hours_estimate: (row.bid_hours_estimate as number | null) ?? null,
      loss_reason: (row.loss_reason as string | null) ?? null,
      outcome_notes: (row.outcome_notes as string | null) ?? null,
      opportunity_id: opp?.id as string,
      title: (opp?.title ?? "Untitled") as string,
      funder_name: (opp?.funder_name ?? null) as string | null,
      url: (opp?.url ?? null) as string | null,
      deadline: (opp?.deadline ?? null) as string | null,
      amount_text: (opp?.amount_text ?? null) as string | null,
    };
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1f2e]">Pipeline</h1>
        <p className="text-sm text-[#6b7280] mt-1">Track your grant applications from interested to won.</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f0ece4] flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[#1a1f2e] mt-4">No applications tracked yet</h3>
          <p className="text-sm text-[#6b7280] mt-2 max-w-sm mx-auto">
            Find grants on your dashboard and add them to your pipeline to track progress.
          </p>
          <a
            href="/dashboard"
            className="inline-block mt-6 px-6 py-2.5 bg-[#c9923a] text-white font-medium rounded-lg text-sm hover:opacity-90 transition-opacity shadow-sm"
          >
            Go to dashboard →
          </a>
        </div>
      ) : (
        <PipelineTable items={items} />
      )}
    </div>
  );
}
