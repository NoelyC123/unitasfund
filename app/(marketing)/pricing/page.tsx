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
    <div style={{ minHeight: "100vh", backgroundColor: "#f7f4ef" }}>
      <div style={{ textAlign: "center", padding: "64px 24px 48px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: "bold", color: "#1a1f2e", marginBottom: "16px" }}>
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: "18px", color: "#6b7280" }}>
          Find more grants. Win more funding. Cancel any time.
        </p>
      </div>

      {error && (
        <div
          style={{
            maxWidth: "1100px",
            margin: "0 auto 24px",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff1f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        </div>
      )}

      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "0 24px 64px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "24px",
        }}
      >
        {cards.map((plan) => {
          const id = plan.id as PlanId;
          const popular = id === "pro";

          const priceRaw = (PLANS[id] as any).monthlyPrice as number | undefined;
          const price = id === "free" ? 0 : priceRaw ?? 0;

          const cta = id === "free" ? "Get started free" : `Start ${PLANS[id].name}`;

          return (
            <div
              key={id}
              style={{
                backgroundColor: "white",
                borderRadius: "16px",
                border: popular ? "2px solid #c9923a" : "1px solid #e8e3da",
                padding: "32px 24px",
                boxShadow: popular ? "0 4px 24px rgba(201,146,58,0.15)" : "0 1px 3px rgba(0,0,0,0.08)",
                position: "relative",
              }}
            >
              {popular && (
                <div
                  style={{
                    position: "absolute",
                    top: "-12px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#c9923a",
                    color: "white",
                    padding: "4px 16px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  Most popular
                </div>
              )}

              <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1f2e", marginBottom: "8px" }}>
                {plan.name}
              </h2>

              <div style={{ marginBottom: "24px" }}>
                {price === 0 ? (
                  <span style={{ fontSize: "32px", fontWeight: "bold", color: "#1a1f2e" }}>Free</span>
                ) : (
                  <>
                    <span style={{ fontSize: "32px", fontWeight: "bold", color: "#1a1f2e" }}>£{price}</span>
                    <span style={{ fontSize: "14px", color: "#6b7280" }}>/mo</span>
                  </>
                )}
              </div>

              <ul style={{ listStyle: "none", padding: 0, marginBottom: "32px" }}>
                {plan.features.map((f: string, i: number) => (
                  <li
                    key={`${id}-${i}`}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "flex-start",
                      marginBottom: "12px",
                      fontSize: "14px",
                      color: "#374151",
                    }}
                  >
                    <span style={{ color: "#c9923a", fontWeight: "bold", flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: loadingPlan === id ? "default" : "pointer",
                  backgroundColor: popular ? "#c9923a" : "#1a1f2e",
                  color: "white",
                  opacity: loadingPlan === id ? 0.7 : 1,
                }}
                disabled={loadingPlan === id}
                onClick={() => startCheckout(id)}
              >
                {loadingPlan === id ? "Loading…" : cta}
              </button>

              {id === "free" && (
                <p style={{ marginTop: "12px", fontSize: "12px", color: "#6b7280" }}>
                  Already have an account?{" "}
                  <Link href="/login" style={{ color: "#c9923a", fontWeight: 600, textDecoration: "none" }}>
                    Log in
                  </Link>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

