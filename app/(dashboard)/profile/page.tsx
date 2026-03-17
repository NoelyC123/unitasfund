import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";

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
    <div className="pb-12">
      <header className="mb-8">
        <p
          className="text-xs font-semibold tracking-widest uppercase mb-1"
          style={{ color: GOLD }}
        >
          Profile
        </p>
        <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>
          Organisation profile
        </h1>
        <p className="text-sm" style={{ color: "#4a5568" }}>
          Updating your profile will re-score all opportunities for your organisation.
        </p>
      </header>

      <ProfileForm initial={initial} />
    </div>
  );
}

