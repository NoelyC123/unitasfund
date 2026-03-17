import { getSupabaseService } from "../db/client";
import { PLANS, type PlanId } from "./plans";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export type SubscriptionRow = {
  user_id: string;
  plan: PlanId;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

export async function getUserPlan(userId: string): Promise<PlanId> {
  const supabase = getSupabaseService();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return "free";
  return (data.plan as PlanId) ?? "free";
}

export async function getPlanLimits(userId: string) {
  const plan = await getUserPlan(userId);
  return PLANS[plan].limits;
}

export function canAccessFeature(
  plan: PlanId,
  feature: keyof typeof PLANS.free.limits
): boolean {
  const limits = PLANS[plan].limits;
  const value = limits[feature as keyof typeof limits];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number(value) !== 0;
  return false;
}

export async function getSubscriptionForUser(
  userId: string
): Promise<SubscriptionRow | null> {
  const supabase = getSupabaseService();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;
  return {
    user_id: String((data as any).user_id),
    plan: ((data as any).plan as PlanId) ?? "free",
    status: ((data as any).status as SubscriptionStatus) ?? "cancelled",
    stripe_customer_id: ((data as any).stripe_customer_id as string | null) ?? null,
    stripe_subscription_id:
      ((data as any).stripe_subscription_id as string | null) ?? null,
    current_period_start:
      ((data as any).current_period_start as string | null) ?? null,
    current_period_end:
      ((data as any).current_period_end as string | null) ?? null,
  };
}

