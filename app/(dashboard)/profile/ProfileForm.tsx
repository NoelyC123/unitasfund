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
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        border: "1px solid #e8e3da",
        padding: "32px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 500,
            color: "#1a1f2e",
            marginBottom: "6px",
          }}
        >
          Organisation name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1px solid #e8e3da",
            fontSize: "14px",
            color: "#1a1f2e",
            outline: "none",
            backgroundColor: "white",
          }}
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 500,
            color: "#1a1f2e",
            marginBottom: "6px",
          }}
        >
          Organisation type
        </label>
        <select
          value={orgType}
          onChange={(e) => setOrgType(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1px solid #e8e3da",
            fontSize: "14px",
            color: "#1a1f2e",
            outline: "none",
            backgroundColor: "white",
          }}
        >
          {ORG_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 500,
            color: "#1a1f2e",
            marginBottom: "6px",
          }}
        >
          Location / region
        </label>
        <input
          value={locationRegion}
          onChange={(e) => setLocationRegion(e.target.value)}
          placeholder="e.g. Cumbria, North West, UK-wide"
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1px solid #e8e3da",
            fontSize: "14px",
            color: "#1a1f2e",
            outline: "none",
            backgroundColor: "white",
          }}
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 500,
            color: "#1a1f2e",
            marginBottom: "6px",
          }}
        >
          Annual income band
        </label>
        <select
          value={incomeBand}
          onChange={(e) => setIncomeBand(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1px solid #e8e3da",
            fontSize: "14px",
            color: "#1a1f2e",
            outline: "none",
            backgroundColor: "white",
          }}
        >
          <option value="">Select…</option>
          {INCOME_BANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 500,
            color: "#1a1f2e",
            marginBottom: "6px",
          }}
        >
          Sectors (comma-separated)
        </label>
        <input
          value={sectorsText}
          onChange={(e) => setSectorsText(e.target.value)}
          placeholder="e.g. community, health, arts & culture"
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: "8px",
            border: "1px solid #e8e3da",
            fontSize: "14px",
            color: "#1a1f2e",
            outline: "none",
            backgroundColor: "white",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        {savedMessage && <p style={{ fontSize: "14px", color: "#16a34a", fontWeight: 500 }}>{savedMessage}</p>}
        {errorMessage && <p style={{ fontSize: "14px", color: "#dc2626", fontWeight: 500 }}>{errorMessage}</p>}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{
            marginLeft: "auto",
            backgroundColor: "#c9923a",
            color: "white",
            padding: "10px 24px",
            borderRadius: "8px",
            border: "none",
            fontSize: "14px",
            fontWeight: 500,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

