"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { PLANS, type PlanId } from "@/lib/stripe/plans";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const BORDER = "#e8e3da";
const MUTED = "#6b7280";

type SubscriptionInfo = {
  plan: PlanId;
  status: string;
  current_period_end: string | null;
};

function formatPrice(planId: PlanId): string {
  if (planId === "free") return "Free";
  const monthly = (PLANS[planId] as any).monthlyPrice as number | undefined;
  return monthly ? `£${monthly}/mo` : "—";
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cards = useMemo(() => {
    const order: PlanId[] = ["free", "starter", "pro", "team", "adviser"];
    return order.map((id) => ({ id, ...PLANS[id] }));
  }, []);

  async function startCheckout(planId: PlanId) {
    setError(null);
    if (planId === "free") {
      window.location.href = "/signup";
      return;
    }

    setLoadingPlan(planId);
    try {
      // If not logged in, this returns 401; we then redirect to signup with selected plan.
      const res = await fetch("/api/stripe/subscription", { method: "GET" });
      const json = (await res.json().catch(() => null)) as SubscriptionInfo | null;
      const isAuthed = Boolean(json && json.status !== "anonymous");
      if (!isAuthed) {
        window.location.href = `/signup?plan=${encodeURIComponent(planId)}`;
        return;
      }

      const priceId = PLANS[planId].priceId;
      if (!priceId) {
        setError("Stripe price ID is not configured for this plan.");
        return;
      }

      const checkout = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, priceId }),
      });
      const out = await checkout.json().catch(() => null);
      if (!checkout.ok) {
        throw new Error(out?.error ?? "Failed to start checkout.");
      }
      if (out?.url) window.location.href = String(out.url);
      else throw new Error("Checkout session URL missing.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout.");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div className="space-y-10">
      <header className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: NAVY }}>
          Simple, transparent pricing
        </h1>
        <p className="text-base sm:text-lg" style={{ color: MUTED }}>
          Find more grants. Win more funding. Cancel any time.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border px-4 py-3" style={{ borderColor: "#fecaca", backgroundColor: "#fff1f2", color: "#991b1b" }}>
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((plan) => {
          const id = plan.id as PlanId;
          const isPopular = id === "pro";
          const buttonLabel =
            id === "free" ? "Get started free" : `Start ${PLANS[id].name}`;

          return (
            <div
              key={id}
              className="rounded-2xl border overflow-hidden shadow-sm"
              style={{
                borderColor: isPopular ? GOLD : BORDER,
                backgroundColor: "#fff",
              }}
            >
              {isPopular && (
                <div className="px-4 py-2 text-xs font-semibold tracking-widest uppercase" style={{ backgroundColor: GOLD, color: NAVY }}>
                  Most popular
                </div>
              )}
              <div className="p-6 space-y-4">
                <div>
                  <div className="text-xl font-bold" style={{ color: NAVY }}>
                    {plan.name}
                  </div>
                  <div className="mt-2 text-3xl font-bold" style={{ color: GOLD }}>
                    {formatPrice(id)}
                  </div>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "#374151" }}>
                      <span className="mt-0.5" style={{ color: GOLD }}>
                        <CheckIcon />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => startCheckout(id)}
                  disabled={loadingPlan === id}
                  className="w-full mt-2 text-sm font-semibold px-5 py-3 rounded-xl hover:opacity-90 disabled:opacity-60"
                  style={{
                    backgroundColor: id === "free" ? NAVY : GOLD,
                    color: id === "free" ? CREAM : NAVY,
                  }}
                >
                  {loadingPlan === id ? "Loading…" : buttonLabel}
                </button>

                {id === "free" && (
                  <p className="text-xs" style={{ color: MUTED }}>
                    Already have an account?{" "}
                    <Link href="/login" className="font-semibold hover:underline" style={{ color: GOLD }}>
                      Log in
                    </Link>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border p-6 sm:p-8 space-y-6" style={{ borderColor: BORDER, backgroundColor: "#fff" }}>
        <h2 className="text-xl font-bold" style={{ color: NAVY }}>
          FAQ
        </h2>

        <div className="space-y-4">
          <div>
            <p className="font-semibold" style={{ color: NAVY }}>
              Can I cancel any time?
            </p>
            <p className="text-sm" style={{ color: MUTED }}>
              Yes — cancel any time from your account settings. No long-term contracts.
            </p>
          </div>
          <div>
            <p className="font-semibold" style={{ color: NAVY }}>
              What happens when I upgrade?
            </p>
            <p className="text-sm" style={{ color: MUTED }}>
              Your account upgrades instantly. You'll be billed pro-rata for the remainder of the month.
            </p>
          </div>
          <div>
            <p className="font-semibold" style={{ color: NAVY }}>
              Do you offer discounts for charities?
            </p>
            <p className="text-sm" style={{ color: MUTED }}>
              Yes — contact us at unitasconnect@hotmail.com for charity and CVS organisation pricing.
            </p>
          </div>
          <div>
            <p className="font-semibold" style={{ color: NAVY }}>
              Is there a free trial?
            </p>
            <p className="text-sm" style={{ color: MUTED }}>
              The free tier is available indefinitely. Paid plans can be cancelled within 30 days for a full refund.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

