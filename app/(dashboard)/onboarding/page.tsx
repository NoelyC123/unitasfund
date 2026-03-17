"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

const ORG_TYPES = [
  { value: "vcse", label: "VCSE / Charity" },
  { value: "sme", label: "SME" },
  { value: "cic", label: "CIC" },
  { value: "other", label: "Other" },
] as const;

const REGIONS = [
  { value: "Cumbria", label: "Cumbria" },
  { value: "Lancaster", label: "Lancaster" },
  { value: "North Lancashire", label: "North Lancashire" },
  { value: "Lancashire", label: "Lancashire" },
  { value: "North West", label: "North West" },
  { value: "England", label: "England" },
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
  "Sport",
  "Heritage",
  "Youth",
  "Other",
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState<string>("vcse");
  const [region, setRegion] = useState<string>("");
  const [incomeBand, setIncomeBand] = useState<string>("");
  const [sectors, setSectors] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSector(sector: string) {
    setSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  }

  function canGoNext(): boolean {
    if (step === 1) return name.trim().length > 1 && Boolean(orgType);
    if (step === 2) return Boolean(region) && Boolean(incomeBand);
    return true;
  }

  function next() {
    if (!canGoNext()) return;
    setMessage(null);
    setStep((s) => (s === 1 ? 2 : s === 2 ? 3 : 3));
  }

  function back() {
    setMessage(null);
    setStep((s) => (s === 3 ? 2 : s === 2 ? 1 : 1));
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
          funding_goals: null,
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
    color: NAVY,
  };

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className="rounded-xl border overflow-hidden shadow-sm"
        style={{ backgroundColor: "#fff", borderColor: "#ece6dd" }}
      >
        <div className="px-6 py-5" style={{ backgroundColor: NAVY }}>
          <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD }}>
            Welcome
          </p>
          <h1 className="text-2xl font-bold mt-1" style={{ color: CREAM }}>
            Let’s set up your organisation
          </h1>
          <p className="text-sm mt-2" style={{ color: "#a8b4c4" }}>
            This takes about a minute. We’ll use it to match you to the right grants.
          </p>

          <div className="mt-4">
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ backgroundColor: "#2d3345" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%`, backgroundColor: GOLD }}
              />
            </div>
            <p className="mt-2 text-xs" style={{ color: "#cbd5e1" }}>
              Step {step} of 3
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1" style={{ color: NAVY }}>
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
                <label className="block text-sm font-medium mb-2" style={{ color: NAVY }}>
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
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: NAVY }}>
                  Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
                  style={inputStyle}
                  required
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
                <label className="block text-sm font-medium mb-2" style={{ color: NAVY }}>
                  Annual income band
                </label>
                <select
                  value={incomeBand}
                  onChange={(e) => setIncomeBand(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
                  style={inputStyle}
                  required
                >
                  <option value="">Select income band</option>
                  {INCOME_BANDS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <label className="block text-sm font-medium" style={{ color: NAVY }}>
                    Sectors
                  </label>
                  <p className="text-sm mt-1" style={{ color: "#4a5568" }}>
                    Choose the areas your work focuses on. You can select more than one.
                  </p>
                </div>
                <span
                  className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ backgroundColor: "#fff7ed", color: "#92400e", border: "1px solid #fde68a" }}
                >
                  Selected: {sectors.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SECTORS.map((sector) => {
                  const active = sectors.includes(sector);
                  return (
                    <button
                      key={sector}
                      type="button"
                      onClick={() => toggleSector(sector)}
                      className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors"
                      style={{
                        borderColor: active ? GOLD : "#ece6dd",
                        backgroundColor: active ? "#fff7ed" : "#fff",
                        color: NAVY,
                      }}
                    >
                      <span className="text-sm font-medium">{sector}</span>
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: active ? GOLD : "#e5e7eb",
                          color: active ? NAVY : "#6b7280",
                        }}
                      >
                        {active ? "✓" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {message && (
            <p className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-700"}`}>
              {message.text}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={back}
              disabled={step === 1 || loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50"
              style={{ borderColor: "#ece6dd", color: NAVY, backgroundColor: "#fff" }}
            >
              Back
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                disabled={!canGoNext() || loading}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: NAVY, color: CREAM }}
              >
                {loading ? "Saving…" : "Finish setup"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
