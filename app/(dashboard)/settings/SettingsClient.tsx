"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/db/browser";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { PLANS } from "@/lib/stripe/plans";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const BORDER = "#e8e3da";
const BODY = "#374151";
const MUTED = "#6b7280";

type AlertFrequency = "daily" | "weekly";
type MinScore = 40 | 60 | 70 | 80;

export default function SettingsClient(props: {
  email: string;
  initial: {
    alerts_enabled: boolean;
    alert_frequency: AlertFrequency;
    alert_min_score: MinScore;
  };
}) {
  const sub = useSubscription();
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(props.initial.alerts_enabled);
  const [frequency, setFrequency] = useState<AlertFrequency>(props.initial.alert_frequency);
  const [minScore, setMinScore] = useState<MinScore>(props.initial.alert_min_score);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  const dirty = useMemo(() => {
    return (
      alertsEnabled !== props.initial.alerts_enabled ||
      frequency !== props.initial.alert_frequency ||
      minScore !== props.initial.alert_min_score
    );
  }, [alertsEnabled, frequency, minScore, props.initial]);

  async function save() {
    setSaving(true);
    setSaved(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alerts_enabled: alertsEnabled,
          alert_frequency: frequency,
          alert_min_score: minScore,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to save settings.");
      setSaved("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset() {
    setSendingReset(true);
    setSaved(null);
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.resetPasswordForEmail(props.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (err) throw err;
      setSaved("Password reset email sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send password reset.");
    } finally {
      setSendingReset(false);
    }
  }

  async function manageBilling() {
    setBillingLoading(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to open billing portal.");
      if (json?.url) window.location.href = String(json.url);
      else throw new Error("Billing portal URL missing.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open billing portal.");
    } finally {
      setBillingLoading(false);
    }
  }

  const planName = PLANS[sub.plan]?.name ?? "Free";
  const nextBilling =
    sub.current_period_end && sub.plan !== "free"
      ? new Date(sub.current_period_end).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <div style={{ maxWidth: "672px", margin: "0 auto", padding: "32px 24px" }}>
      <h1
        style={{
          fontFamily: "var(--font-heading, Georgia, serif)",
          fontSize: "28px",
          fontWeight: "700",
          color: "#1a1f2e",
          letterSpacing: "-0.02em",
          marginBottom: "8px",
          lineHeight: "1.2",
        }}
      >
        Settings
      </h1>
      <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "32px" }}>
        Manage your alerts and account preferences.
      </p>

      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #e8e3da",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          marginBottom: "16px",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading, Georgia, serif)",
            fontSize: "18px",
            fontWeight: 600,
            color: "#1a1f2e",
            marginBottom: "16px",
            letterSpacing: "-0.01em",
          }}
        >
          Alert preferences
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 0",
            borderBottom: "1px solid #f0ece4",
            gap: "16px",
          }}
        >
          <div>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#1a1f2e" }}>
              Email me when new matches are found
            </p>
            <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
              We'll email you when new opportunities meet your minimum score.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={alertsEnabled}
            onClick={() => setAlertsEnabled((v) => !v)}
            type="button"
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "999px",
              border: "none",
              cursor: "pointer",
              backgroundColor: alertsEnabled ? "#c9923a" : "#e5e7eb",
              position: "relative",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "999px",
                backgroundColor: "white",
                position: "absolute",
                top: "4px",
                left: alertsEnabled ? "24px" : "4px",
                transition: "left 200ms ease",
                boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>

        <div style={{ padding: "12px 0", borderBottom: "1px solid #f0ece4" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
            Frequency
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as AlertFrequency)}
            style={{
              width: "100%",
              maxWidth: "192px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #e8e3da",
              backgroundColor: "white",
              color: "#1a1f2e",
              fontSize: "14px",
              outline: "none",
            }}
          >
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </div>

        <div style={{ padding: "12px 0" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
            Minimum score
          </label>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value) as MinScore)}
            style={{
              width: "100%",
              maxWidth: "192px",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #e8e3da",
              backgroundColor: "white",
              color: "#1a1f2e",
              fontSize: "14px",
              outline: "none",
            }}
          >
            <option value="40">40% and above</option>
            <option value="60">60% and above</option>
            <option value="70">70% and above</option>
            <option value="80">80% and above</option>
          </select>
        </div>

        {(saved || error) && (
          <div style={{ marginTop: "8px" }}>
            {saved && <p style={{ fontSize: "14px", color: "#16a34a", fontWeight: 500 }}>{saved}</p>}
            {error && <p style={{ fontSize: "14px", color: "#dc2626", fontWeight: 500 }}>{error}</p>}
          </div>
        )}

        <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f0ece4" }}>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            style={{
              backgroundColor: "#c9923a",
              color: "white",
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              fontSize: "14px",
              fontWeight: 600,
              cursor: saving || !dirty ? "default" : "pointer",
              opacity: saving || !dirty ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #e8e3da",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          marginBottom: "16px",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading, Georgia, serif)",
            fontSize: "18px",
            fontWeight: 600,
            color: "#1a1f2e",
            marginBottom: "16px",
            letterSpacing: "-0.01em",
          }}
        >
          Account
        </h2>
        <div style={{ padding: "12px 0", borderBottom: "1px solid #f0ece4" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>
            Email
          </p>
          <p style={{ fontSize: "14px", color: "#1a1f2e" }}>{props.email}</p>
        </div>
        <div style={{ paddingTop: "16px" }}>
          <button
            onClick={sendPasswordReset}
            disabled={sendingReset}
            type="button"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: "14px",
              fontWeight: 600,
              color: "#c9923a",
              cursor: sendingReset ? "default" : "pointer",
              opacity: sendingReset ? 0.6 : 1,
            }}
          >
            {sendingReset ? "Sending…" : "Change password →"}
          </button>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid #e8e3da",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-heading, Georgia, serif)",
            fontSize: "18px",
            fontWeight: 600,
            color: "#1a1f2e",
            marginBottom: "16px",
            letterSpacing: "-0.01em",
          }}
        >
          Plan
        </h2>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#1a1f2e" }}>{sub.loading ? "Loading…" : planName}</p>
            {nextBilling && <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>Next billing date: {nextBilling}</p>}
            {!sub.loading && sub.plan === "free" && (
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Upgrade to unlock full match reasons, EV detail and unlimited pipeline.
              </p>
            )}
          </div>
          {sub.plan === "free" ? (
            <a
              href="/pricing"
              style={{
                display: "inline-block",
                backgroundColor: "#c9923a",
                color: "white",
                padding: "10px 24px",
                borderRadius: "8px",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              Upgrade →
            </a>
          ) : (
            <button
              type="button"
              onClick={manageBilling}
              disabled={billingLoading}
              style={{
                backgroundColor: "white",
                color: "#1a1f2e",
                border: "1px solid #e8e3da",
                padding: "10px 16px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: billingLoading ? "default" : "pointer",
                opacity: billingLoading ? 0.6 : 1,
              }}
            >
              {billingLoading ? "Opening…" : "Manage billing →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

