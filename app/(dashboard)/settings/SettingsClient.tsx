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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1f2e]">Settings</h1>
        <p className="text-sm text-[#6b7280] mt-1">Manage your alerts and account preferences.</p>
      </div>

      <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm p-6 mb-4">
        <h2 className="text-base font-semibold text-[#1a1f2e] mb-4">Alert preferences</h2>

        <div className="flex items-center justify-between py-3 border-b border-[#f0ece4]">
          <div>
            <p className="text-sm font-medium text-[#1a1f2e]">Email me when new matches are found</p>
            <p className="text-xs text-[#6b7280] mt-0.5">
              We'll email you when new opportunities meet your minimum score.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={alertsEnabled}
            onClick={() => setAlertsEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#c9923a] focus:ring-offset-2 ${
              alertsEnabled ? "bg-[#c9923a]" : "bg-gray-200"
            }`}
            type="button"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                alertsEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="py-3 border-b border-[#f0ece4]">
          <label className="block text-xs font-medium text-[#6b7280] uppercase tracking-wider mb-2">Frequency</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as AlertFrequency)}
            className="w-full sm:w-48 py-2 px-3 text-sm rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
          >
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </div>

        <div className="py-3">
          <label className="block text-xs font-medium text-[#6b7280] uppercase tracking-wider mb-2">Minimum score</label>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value) as MinScore)}
            className="w-full sm:w-48 py-2 px-3 text-sm rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
          >
            <option value="40">40% and above</option>
            <option value="60">60% and above</option>
            <option value="70">70% and above</option>
            <option value="80">80% and above</option>
          </select>
        </div>

        {(saved || error) && (
          <div className="mt-2">
            {saved && <p className="text-sm text-green-600 font-medium">{saved}</p>}
            {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-[#f0ece4]">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="px-6 py-2.5 bg-[#c9923a] text-white font-medium rounded-lg text-sm hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm p-6 mb-4">
        <h2 className="text-base font-semibold text-[#1a1f2e] mb-4">Account</h2>
        <div className="py-3 border-b border-[#f0ece4] flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#6b7280] uppercase tracking-wider mb-1">Email</p>
            <p className="text-sm text-[#1a1f2e]">{props.email}</p>
          </div>
        </div>
        <div className="pt-4">
          <button
            onClick={sendPasswordReset}
            disabled={sendingReset}
            className="text-sm text-[#c9923a] hover:underline font-medium disabled:opacity-60"
            type="button"
          >
            {sendingReset ? "Sending…" : "Change password →"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm p-6">
        <h2 className="text-base font-semibold text-[#1a1f2e] mb-4">Plan</h2>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-[#1a1f2e]">{sub.loading ? "Loading…" : planName}</p>
            {nextBilling && <p className="text-xs text-[#6b7280] mt-1">Next billing date: {nextBilling}</p>}
            {!sub.loading && sub.plan === "free" && (
              <p className="text-xs text-[#6b7280] mt-1">
                Upgrade to unlock full match reasons, EV detail and unlimited pipeline.
              </p>
            )}
          </div>

          {sub.plan === "free" ? (
            <a
              href="/pricing"
              className="px-6 py-2.5 bg-[#c9923a] text-white font-medium rounded-lg text-sm hover:opacity-90 transition-opacity shadow-sm"
            >
              Upgrade →
            </a>
          ) : (
            <button
              type="button"
              onClick={manageBilling}
              disabled={billingLoading}
              className="px-4 py-2.5 rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] text-sm font-medium hover:bg-[#f7f4ef] disabled:opacity-60"
            >
              {billingLoading ? "Opening…" : "Manage billing →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

