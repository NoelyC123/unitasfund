import { useEffect, useState } from "react";
import type { PlanId } from "@/lib/stripe/plans";

export type SubscriptionInfo = {
  plan: PlanId;
  status: string;
  current_period_end: string | null;
};

export function useSubscription() {
  const [data, setData] = useState<SubscriptionInfo>({
    plan: "free",
    status: "loading",
    current_period_end: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch("/api/stripe/subscription", { method: "GET" });
        const json = (await res.json().catch(() => null)) as SubscriptionInfo | null;
        if (cancelled) return;
        if (json?.plan) {
          setData({
            plan: json.plan,
            status: json.status ?? "unknown",
            current_period_end: json.current_period_end ?? null,
          });
        } else {
          setData({ plan: "free", status: "unknown", current_period_end: null });
        }
      } catch {
        if (!cancelled) setData({ plan: "free", status: "error", current_period_end: null });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading };
}

