import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import PipelineTable from "./PipelineTable";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

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
      <div
        className="rounded-xl p-8"
        style={{ backgroundColor: "#fff", border: "1px solid #ece6dd" }}
      >
        <h1 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>
          Pipeline
        </h1>
        <p className="mb-4" style={{ color: "#4a5568" }}>
          You need an organisation profile before you can use the pipeline.
        </p>
        <a
          href="/onboarding"
          className="inline-block px-4 py-2 rounded-lg font-semibold"
          style={{ backgroundColor: GOLD, color: NAVY }}
        >
          Set up organisation profile
        </a>
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
      <div
        className="rounded-xl p-8"
        style={{ backgroundColor: "#fff", border: "1px solid #ece6dd" }}
      >
        <h1 className="text-2xl font-bold mb-2" style={{ color: NAVY }}>
          Pipeline
        </h1>
        <p className="text-red-600">Error loading pipeline: {error.message}</p>
      </div>
    );
  }

  const items = (pipelineRows ?? []).map((row: Record<string, unknown>) => {
    const opp = row.opportunities as Record<string, unknown> | null;
    return {
      id: row.id as string,
      status: row.status as string,
      notes: (row.notes as string) ?? "",
      opportunity_id: opp?.id as string,
      title: (opp?.title ?? "Untitled") as string,
      funder_name: (opp?.funder_name ?? null) as string | null,
      url: (opp?.url ?? null) as string | null,
      deadline: (opp?.deadline ?? null) as string | null,
      amount_text: (opp?.amount_text ?? null) as string | null,
    };
  });

  return (
    <div className="pb-12">
      <header className="mb-8">
        <p
          className="text-xs font-semibold tracking-widest uppercase mb-1"
          style={{ color: GOLD }}
        >
          Pipeline
        </p>
        <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>
          Your applications
        </h1>
        <p className="text-sm" style={{ color: "#4a5568" }}>
          Track opportunities you&apos;ve added. Update status as you progress.
        </p>
      </header>

      {items.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "#fff", border: "1px solid #ece6dd" }}
        >
          <p className="mb-2" style={{ color: NAVY }}>
            No opportunities in your pipeline yet.
          </p>
          <p className="text-sm mb-4" style={{ color: "#4a5568" }}>
            Add opportunities from the dashboard to track them here.
          </p>
          <a
            href="/dashboard"
            className="inline-block px-4 py-2 rounded-lg font-semibold"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            Go to dashboard
          </a>
        </div>
      ) : (
        <PipelineTable items={items} />
      )}
    </div>
  );
}
