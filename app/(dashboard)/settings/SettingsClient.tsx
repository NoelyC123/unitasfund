"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/db/browser";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";

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
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>
          Settings
        </h1>
        <p className="text-sm" style={{ color: "#4a5568" }}>
          Manage your email alerts and account settings.
        </p>
      </header>

      <section className="rounded-2xl border p-6" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: NAVY }}>
          Alert preferences
        </h2>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Email me when new matches are found
            </p>
            <p className="text-sm" style={{ color: "#4a5568" }}>
              We'll email you when new opportunities meet your minimum score.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAlertsEnabled((v) => !v)}
            className="text-sm font-semibold px-3 py-2 rounded-lg border hover:opacity-90"
            style={{
              borderColor: alertsEnabled ? "#fde68a" : "#ece6dd",
              backgroundColor: alertsEnabled ? "#fff7ed" : "#faf8f5",
              color: NAVY,
            }}
          >
            {alertsEnabled ? "Enabled" : "Disabled"}
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
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: NAVY }}
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
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: NAVY }}
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
            className="text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-95 disabled:opacity-50"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            {saving ? "Saving…" : "Save"}
          </button>

          {saved && <span className="text-sm" style={{ color: "#16a34a" }}>{saved}</span>}
          {error && <span className="text-sm" style={{ color: "#b91c1c" }}>{error}</span>}
        </div>
      </section>

      <section className="rounded-2xl border p-6" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
        <h2 className="text-lg font-bold mb-4" style={{ color: NAVY }}>
          Account
        </h2>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              Email
            </p>
            <p className="text-sm" style={{ color: "#4a5568" }}>
              {props.email}
            </p>
          </div>

          <button
            type="button"
            onClick={sendPasswordReset}
            disabled={sendingReset}
            className="text-sm font-semibold px-3 py-2 rounded-lg border hover:opacity-90 disabled:opacity-50"
            style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5", color: NAVY }}
          >
            {sendingReset ? "Sending…" : "Change password"}
          </button>
        </div>
      </section>
    </div>
  );
}

