"use client";

import { useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";

const ORG_TYPES = [
  { value: "vcse", label: "VCSE / Charity" },
  { value: "cic", label: "CIC" },
  { value: "sme", label: "SME" },
  { value: "other", label: "Other" },
] as const;

const INCOME_BANDS = [
  "Under £10k",
  "£10k-£50k",
  "£50k-£100k",
  "£100k-£500k",
  "£500k+",
] as const;

export default function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    org_type: string;
    location_region: string | null;
    annual_income_band: string | null;
    sectors: string[];
  };
}) {
  const [name, setName] = useState(initial.name);
  const [orgType, setOrgType] = useState(initial.org_type);
  const [locationRegion, setLocationRegion] = useState(initial.location_region ?? "");
  const [incomeBand, setIncomeBand] = useState(initial.annual_income_band ?? "");
  const [sectorsText, setSectorsText] = useState(initial.sectors.join(", "));

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const sectors = sectorsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          org_type: orgType,
          location_region: locationRegion || null,
          annual_income_band: incomeBand || null,
          sectors,
        }),
      });

      const json = (await res.json()) as { ok?: boolean; error?: string; rescored?: number };
      if (!res.ok) {
        setMessage(json.error ?? "Failed to save.");
        return;
      }
      setMessage(`Saved. Re-scored ${json.rescored ?? 0} opportunities.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl p-6 border"
      style={{ backgroundColor: "#fff", borderColor: "#ece6dd" }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1">
          <span className="text-sm font-semibold" style={{ color: NAVY }}>
            Organisation name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "#ece6dd" }}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-semibold" style={{ color: NAVY }}>
            Organisation type
          </span>
          <select
            value={orgType}
            onChange={(e) => setOrgType(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "#ece6dd" }}
          >
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-semibold" style={{ color: NAVY }}>
            Location / region
          </span>
          <input
            value={locationRegion}
            onChange={(e) => setLocationRegion(e.target.value)}
            placeholder="e.g. Cumbria, North West, UK-wide"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "#ece6dd" }}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm font-semibold" style={{ color: NAVY }}>
            Annual income band
          </span>
          <select
            value={incomeBand}
            onChange={(e) => setIncomeBand(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "#ece6dd" }}
          >
            <option value="">Select…</option>
            {INCOME_BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-semibold" style={{ color: NAVY }}>
            Sectors (comma-separated)
          </span>
          <input
            value={sectorsText}
            onChange={(e) => setSectorsText(e.target.value)}
            placeholder="e.g. community, health, arts & culture"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "#ece6dd" }}
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
          style={{ backgroundColor: GOLD, color: NAVY }}
        >
          {saving ? "Saving & re-scoring…" : "Save profile"}
        </button>
        {message && (
          <p className="text-sm" style={{ color: message.startsWith("Saved") ? "#166534" : "#b91c1c" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

