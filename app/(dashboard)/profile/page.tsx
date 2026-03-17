import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";
import ProfileForm from "./ProfileForm";

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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1f2e]">Organisation Profile</h1>
        <p className="text-sm text-[#6b7280] mt-1">Updating your profile will re-score all opportunities.</p>
      </div>

      <ProfileForm initial={initial} />
    </div>
  );
}

