import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getSupabaseService } from "@/lib/db/client";
import { PLANS, type PlanId } from "@/lib/stripe/plans";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ plan: "free", status: "anonymous" });
  }

  const service = getSupabaseService();
  const { data } = await service
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = ((data?.plan as PlanId) ?? "free") in PLANS ? ((data?.plan as PlanId) ?? "free") : "free";
  const status = (data?.status as string | null) ?? "none";
  const current_period_end = (data?.current_period_end as string | null) ?? null;

  return NextResponse.json({ plan, status, current_period_end });
}

