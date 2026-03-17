"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/db/browser";

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
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(props.initial.alerts_enabled);
  const [frequency, setFrequency] = useState<AlertFrequency>(props.initial.alert_frequency);
  const [minScore, setMinScore] = useState<MinScore>(props.initial.alert_min_score);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

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

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h1 className="text-3xl font-bold mb-2" style={{ color: NAVY }}>
          Settings
        </h1>
        <p className="text-sm" style={{ color: MUTED }}>
          Manage your email alerts and account settings.
        </p>
      </header>

      <section className="rounded-xl border p-6" style={{ borderColor: BORDER, backgroundColor: "#fff" }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: NAVY }}>
          Alert preferences
        </h2>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Email me when new matches are found
            </p>
            <p className="text-sm" style={{ color: MUTED }}>
              We'll email you when new opportunities meet your minimum score.
            </p>
          </div>
          <button type="button" onClick={() => setAlertsEnabled((v) => !v)} className="shrink-0">
            <span className="sr-only">Toggle alerts</span>
            <span
              className="relative inline-flex h-7 w-12 items-center rounded-full border transition-colors"
              style={{
                backgroundColor: alertsEnabled ? GOLD : "#e5e7eb",
                borderColor: alertsEnabled ? GOLD : BORDER,
              }}
            >
              <span
                className="inline-block h-5 w-5 transform rounded-full transition-transform"
                style={{
                  backgroundColor: "#ffffff",
                  transform: alertsEnabled ? "translateX(24px)" : "translateX(6px)",
                }}
              />
            </span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD }}>
              Frequency
            </span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as AlertFrequency)}
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
              style={{ borderColor: BORDER, backgroundColor: "#fff", color: BODY }}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD }}>
              Minimum score
            </span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value) as MinScore)}
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
              style={{ borderColor: BORDER, backgroundColor: "#fff", color: BODY }}
            >
              <option value={40}>40%</option>
              <option value={60}>60%</option>
              <option value={70}>70%</option>
              <option value={80}>80%</option>
            </select>
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={save}
            className="text-sm font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            {saving ? "Saving…" : "Save"}
          </button>

          {saved && <span className="text-sm" style={{ color: "#16a34a" }}>{saved}</span>}
          {error && <span className="text-sm" style={{ color: "#b91c1c" }}>{error}</span>}
        </div>
      </section>

      <section className="rounded-xl border p-6" style={{ borderColor: BORDER, backgroundColor: "#fff" }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: NAVY }}>
          Account
        </h2>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Email
            </p>
            <p className="text-sm" style={{ color: MUTED }}>
              {props.email}
            </p>
          </div>

          <button
            type="button"
            onClick={sendPasswordReset}
            disabled={sendingReset}
            className="text-sm font-semibold px-4 py-2.5 rounded-lg border hover:opacity-90 disabled:opacity-50"
            style={{ borderColor: BORDER, backgroundColor: CREAM, color: NAVY }}
          >
            {sendingReset ? "Sending…" : "Change password"}
          </button>
        </div>
      </section>
    </div>
  );
}

