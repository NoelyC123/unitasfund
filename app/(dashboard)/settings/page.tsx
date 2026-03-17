import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import SettingsClient from "./SettingsClient";

export const metadata = {
  title: "Settings | UnitasFund",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("alerts_enabled, alert_frequency, alert_min_score")
    .eq("id", user.id)
    .single();

  return (
    <SettingsClient
      email={user.email ?? ""}
      initial={{
        alerts_enabled: Boolean(profile?.alerts_enabled ?? true),
        alert_frequency: (profile?.alert_frequency ?? "weekly") as "daily" | "weekly",
        alert_min_score: (profile?.alert_min_score ?? 60) as 40 | 60 | 70 | 80,
      }}
    />
  );
}

