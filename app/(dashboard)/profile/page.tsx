import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";
import FadeIn from "@/components/FadeIn";

export const metadata = {
  title: "Profile | UnitasFund",
};

export default async function ProfilePage() {
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
    .select("name, org_type, location_region, annual_income_band, sectors")
    .eq("id", organisationId)
    .single();

  const initial = {
    name: String(orgRow?.name ?? ""),
    org_type: String(orgRow?.org_type ?? "other"),
    location_region: (orgRow?.location_region as string | null) ?? null,
    annual_income_band: (orgRow?.annual_income_band as string | null) ?? null,
    sectors: Array.isArray(orgRow?.sectors)
      ? (orgRow?.sectors as unknown[]).map(String)
      : typeof orgRow?.sectors === "object" && orgRow?.sectors
      ? Object.values(orgRow.sectors as Record<string, unknown>).map(String)
      : [],
  };

  return (
    <FadeIn>
      <div className="max-w-2xl mx-auto">
        <div
          className="rounded-xl border p-8"
          style={{ backgroundColor: "#fff", borderColor: "#ece6dd" }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "#c9923a" }}>
            Your organisation
          </p>
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: "#1a1f2e", fontFamily: "var(--font-heading, Georgia, serif)" }}
          >
            Organisation Profile
          </h1>
          <p className="text-sm mb-6" style={{ color: "#4a5568" }}>
            Updating your profile will re-score all opportunities.
          </p>

          <ProfileForm initial={initial} />
        </div>
      </div>
    </FadeIn>
  );
}

