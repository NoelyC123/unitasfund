"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ORG_TYPES = [
  { value: "vcse", label: "VCSE" },
  { value: "sme", label: "SME" },
  { value: "cic", label: "CIC" },
  { value: "other", label: "Other" },
] as const;

const REGIONS = [
  { value: "Cumbria", label: "Cumbria" },
  { value: "Lancaster", label: "Lancaster" },
  { value: "North Lancashire", label: "North Lancashire" },
  { value: "UK-wide", label: "UK-wide" },
] as const;

const INCOME_BANDS = [
  { value: "Under £10k", label: "Under £10k" },
  { value: "£10k-£50k", label: "£10k–£50k" },
  { value: "£50k-£100k", label: "£50k–£100k" },
  { value: "£100k-£500k", label: "£100k–£500k" },
  { value: "£500k+", label: "£500k+" },
] as const;

const SECTORS = [
  "Community",
  "Arts & Culture",
  "Environment",
  "Health",
  "Education",
  "Housing",
  "Employment",
  "Other",
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<string>("vcse");
  const [region, setRegion] = useState<string>("");
  const [incomeBand, setIncomeBand] = useState<string>("");
  const [sectors, setSectors] = useState<string[]>([]);
  const [fundingGoals, setFundingGoals] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSector(sector: string) {
    setSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          org_type: orgType,
          location_region: region || null,
          annual_income_band: incomeBand || null,
          sectors,
          funding_goals: fundingGoals.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Something went wrong." });
        return;
      }
      setMessage({ type: "success", text: "Profile saved." });
      router.refresh();
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    borderColor: "#ece6dd",
    backgroundColor: "#fff",
    color: "#1a1f2e",
  };

  return (
    <div
      className="rounded-xl p-8 shadow-lg max-w-2xl mx-auto"
      style={{ backgroundColor: "#ffffff", border: "1px solid #ece6dd" }}
    >
      <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "#c9923a" }}>
        Get started
      </p>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a1f2e" }}>
        Organisation profile
      </h1>
      <p className="text-sm mb-6" style={{ color: "#4a5568" }}>
        Tell us about your organisation so we can match you with the right funding opportunities.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1" style={{ color: "#1a1f2e" }}>
            Organisation name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "#1a1f2e" }}>
            Organisation type
          </label>
          <select
            value={orgType}
            onChange={(e) => setOrgType(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            style={inputStyle}
          >
            {ORG_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "#1a1f2e" }}>
            Region
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            style={inputStyle}
          >
            <option value="">Select region</option>
            {REGIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "#1a1f2e" }}>
            Annual income band
          </label>
          <select
            value={incomeBand}
            onChange={(e) => setIncomeBand(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            style={inputStyle}
          >
            <option value="">Select income band</option>
            {INCOME_BANDS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "#1a1f2e" }}>
            Sectors
          </label>
          <div className="flex flex-wrap gap-3">
            {SECTORS.map((sector) => (
              <label
                key={sector}
                className="flex items-center gap-2 cursor-pointer text-sm"
                style={{ color: "#1a1f2e" }}
              >
                <input
                  type="checkbox"
                  checked={sectors.includes(sector)}
                  onChange={() => toggleSector(sector)}
                  className="rounded focus:ring-[#c9923a]"
                  style={{ borderColor: "#c9923a" }}
                />
                {sector}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="funding_goals" className="block text-sm font-medium mb-1" style={{ color: "#1a1f2e" }}>
            What do you need funding for?
          </label>
          <textarea
            id="funding_goals"
            value={fundingGoals}
            onChange={(e) => setFundingGoals(e.target.value)}
            rows={4}
            className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a] resize-y"
            style={inputStyle}
            placeholder="e.g. core costs, a specific project, equipment…"
          />
        </div>
        {message && (
          <p className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-700"}`}>
            {message.text}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-lg font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "#1a1f2e", color: "#f7f4ef" }}
        >
          {loading ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
