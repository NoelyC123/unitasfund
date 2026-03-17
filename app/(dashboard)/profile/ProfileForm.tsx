"use client";

import { useState } from "react";

const GOLD = "#c9923a";
const BORDER = "#e8e3da";

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
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setSavedMessage(null);
    setErrorMessage(null);
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
        setErrorMessage(json.error ?? "Failed to save.");
        return;
      }
      setSavedMessage("✓ Profile saved — re-scoring in progress");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm p-6 sm:p-8">
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[#1a1f2e] mb-1.5">Organisation name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] text-sm focus:outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent placeholder-[#9ca3af]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1a1f2e] mb-1.5">Organisation type</label>
          <select
            value={orgType}
            onChange={(e) => setOrgType(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] text-sm focus:outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
          >
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1a1f2e] mb-1.5">Location / region</label>
          <input
            value={locationRegion}
            onChange={(e) => setLocationRegion(e.target.value)}
            placeholder="e.g. Cumbria, North West, UK-wide"
            className="w-full px-4 py-2.5 rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] text-sm focus:outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent placeholder-[#9ca3af]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1a1f2e] mb-1.5">Annual income band</label>
          <select
            value={incomeBand}
            onChange={(e) => setIncomeBand(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] text-sm focus:outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
          >
            <option value="">Select…</option>
            {INCOME_BANDS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1a1f2e] mb-1.5">Sectors (comma-separated)</label>
          <input
            value={sectorsText}
            onChange={(e) => setSectorsText(e.target.value)}
            placeholder="e.g. community, health, arts & culture"
            className="w-full px-4 py-2.5 rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] text-sm focus:outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent placeholder-[#9ca3af]"
          />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-[#e8e3da] flex items-center justify-between">
        <div>
          {savedMessage && <p className="text-sm text-green-600 font-medium">{savedMessage}</p>}
          {errorMessage && <p className="text-sm text-red-600 font-medium">{errorMessage}</p>}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="ml-auto px-6 py-2.5 bg-[#c9923a] text-white font-medium rounded-lg text-sm hover:opacity-90 transition-opacity shadow-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

