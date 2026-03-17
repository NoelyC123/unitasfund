"use client";

import { useMemo, useState } from "react";
import OpportunityRow from "./OpportunityRow";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const BORDER = "#e8e3da";
const BODY = "#374151";
const MUTED = "#6b7280";

type FitBreakdown = {
  location_score?: number;
  sector_score?: number;
  income_score?: number;
  deadline_score?: number;
};

type Row = {
  id: string;
  source_id: string | null;
  title: string;
  funder_name: string | null;
  url: string | null;
  fit_score: number;
  fit_breakdown: FitBreakdown | null;
  ev: number | null;
  deadline: string | null;
  amount_text: string | null;
  last_checked_at?: string | null;
  match_reasons?: string[];
  is_active: boolean;
};

type ScoreBand = "ALL" | "HIGH" | "MEDIUM" | "LOW";
type SortKey = "FIT" | "DEADLINE" | "EV";

function bandFor(score: number): ScoreBand {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

function deadlineValue(deadline: string | null): number {
  if (!deadline || !deadline.trim()) return Number.POSITIVE_INFINITY;
  const d = new Date(deadline.trim());
  const t = d.getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export default function DashboardClient({
  orgName,
  rows,
  profileIncomplete = false,
}: {
  orgName: string;
  rows: Row[];
  profileIncomplete?: boolean;
}) {
  const [band, setBand] = useState<ScoreBand>("ALL");
  const [funder, setFunder] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("FIT");
  const [query, setQuery] = useState<string>("");
  const [hideProfileBanner, setHideProfileBanner] = useState(false);

  const totalMatched = rows.length;
  const highCount = useMemo(
    () => rows.filter((r) => r.fit_score >= 75).length,
    [rows]
  );

  const funderOptions = useMemo(() => {
    const values = new Set<string>();
    for (const r of rows) {
      if (r.funder_name && r.funder_name.trim()) values.add(r.funder_name.trim());
    }
    return ["ALL", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filteredSorted = useMemo(() => {
    let out = rows.slice();
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        const title = (r.title ?? "").toLowerCase();
        const funderName = (r.funder_name ?? "").toLowerCase();
        return title.includes(q) || funderName.includes(q);
      });
    }
    if (band !== "ALL") out = out.filter((r) => bandFor(r.fit_score) === band);
    if (funder !== "ALL") out = out.filter((r) => (r.funder_name ?? "") === funder);

    out.sort((a, b) => {
      if (sortKey === "DEADLINE") return deadlineValue(a.deadline) - deadlineValue(b.deadline);
      if (sortKey === "EV") return (b.ev ?? -Infinity) - (a.ev ?? -Infinity);
      return b.fit_score - a.fit_score;
    });

    return out.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, band, funder, sortKey, query]);

  const topScore = filteredSorted[0]?.fit_score ?? 0;

  return (
    <div className="pb-12">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-2" style={{ color: NAVY }}>
          {orgName}
        </h1>
        <p className="text-sm" style={{ color: MUTED }}>
          {totalMatched === 0
            ? "No grant opportunities matched yet."
            : `${totalMatched} ${totalMatched === 1 ? "opportunity" : "opportunities"} matched — ${highCount} HIGH fit. Top fit score: ${Math.round(topScore)}%.`}
        </p>
      </header>

      {profileIncomplete && !hideProfileBanner && (
        <div
          className="mb-6 rounded-xl border px-4 py-3 flex items-start justify-between gap-3 flex-wrap"
          style={{ backgroundColor: GOLD, borderColor: GOLD }}
        >
          <div className="flex items-start gap-3">
            <span
              className="shrink-0 mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ backgroundColor: "rgba(255,255,255,0.25)", color: NAVY }}
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>
                Your profile is incomplete — complete it to get better matches
              </p>
              <a href="/profile" className="text-sm hover:underline font-semibold" style={{ color: NAVY }}>
                Complete your profile →
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHideProfileBanner(true)}
            className="text-xs font-semibold px-2 py-1 rounded-lg border hover:opacity-90"
            style={{ borderColor: "rgba(26,31,46,0.25)", backgroundColor: "rgba(255,255,255,0.15)", color: NAVY }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters bar */}
      <div
        className="rounded-xl border shadow-sm p-4 sm:p-5 mb-6"
        style={{ backgroundColor: "#ffffff", borderColor: BORDER }}
      >
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: MUTED }}>
              Search
            </label>
            <div className="relative">
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: MUTED }}
                aria-hidden="true"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search grants and funders..."
                className="w-full rounded-lg border px-9 pr-24 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                style={{ borderColor: BORDER, backgroundColor: "#ffffff", color: BODY }}
              />
              {query.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold px-2.5 py-1.5 rounded-md border hover:opacity-90"
                  style={{ borderColor: BORDER, backgroundColor: CREAM, color: NAVY }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto">
            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                Score band
              </span>
              <select
                value={band}
                onChange={(e) => setBand(e.target.value as ScoreBand)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                style={{ borderColor: BORDER, backgroundColor: "#ffffff", color: BODY }}
              >
                <option value="ALL">All</option>
                <option value="HIGH">HIGH (75%+)</option>
                <option value="MEDIUM">MEDIUM (50–74%)</option>
                <option value="LOW">LOW (&lt;50%)</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                Funder
              </span>
              <select
                value={funder}
                onChange={(e) => setFunder(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                style={{ borderColor: BORDER, backgroundColor: "#ffffff", color: BODY }}
              >
                {funderOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                Sort
              </span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                style={{ borderColor: BORDER, backgroundColor: "#ffffff", color: BODY }}
              >
                <option value="FIT">Fit score</option>
                <option value="DEADLINE">Deadline</option>
                <option value="EV">Est. value</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end">
          <span className="text-sm" style={{ color: MUTED }}>
            {filteredSorted.length} shown
          </span>
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}` }}
        >
          <p className="mb-2" style={{ color: NAVY }}>
            No opportunities match your filters.
          </p>
          <p className="text-sm" style={{ color: MUTED }}>
            Try widening the score band or selecting a different funder.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSorted.map((row) => (
            <OpportunityRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

