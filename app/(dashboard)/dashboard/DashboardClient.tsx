"use client";

import { useEffect, useMemo, useState } from "react";
import OpportunityRow from "./OpportunityRow";
import type { PlanId } from "@/lib/stripe/plans";

const BORDER = "#e8e3da";

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
  plan,
  pipelineCount,
}: {
  orgName: string;
  rows: Row[];
  profileIncomplete?: boolean;
  plan: PlanId;
  pipelineCount: number;
}) {
  const [band, setBand] = useState<ScoreBand>("ALL");
  const [funder, setFunder] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("FIT");
  const [query, setQuery] = useState<string>("");
  const [hideProfileBanner, setHideProfileBanner] = useState(false);
  const [upgradeSuccessVisible, setUpgradeSuccessVisible] = useState(false);

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
  const isFree = plan === "free";

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("upgraded") === "true") {
      setUpgradeSuccessVisible(true);
      url.searchParams.delete("upgraded");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a1f2e]">{orgName}</h1>
        <p className="text-sm text-[#6b7280] mt-1">
          {totalMatched === 0
            ? "No grant opportunities matched yet."
            : `${totalMatched} opportunities matched — ${highCount} HIGH fit. Top score: ${Math.round(topScore)}%`}
        </p>
      </div>

      {upgradeSuccessVisible && (
        <div
          className="mb-6 bg-white rounded-xl border border-[#e8e3da] shadow-sm p-4 flex items-start justify-between gap-3 flex-wrap"
        >
          <div>
            <p className="text-sm font-medium text-[#1a1f2e]">
              Welcome to your upgraded plan! You now have access to full match reasons, EV scores and unlimited pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUpgradeSuccessVisible(false)}
            className="text-xs font-medium text-[#6b7280] hover:text-[#1a1f2e]"
          >
            Dismiss
          </button>
        </div>
      )}

      {isFree && (
        <div
          className="mb-6 bg-white rounded-xl border border-[#e8e3da] shadow-sm p-4 flex items-start justify-between gap-3 flex-wrap"
        >
          <div>
            <p className="text-sm font-medium text-[#1a1f2e]">
              You're on the Free plan — upgrade to unlock full match reasons, EV scores and unlimited pipeline
            </p>
          </div>
          <a href="/pricing" className="text-sm font-medium text-[#c9923a] hover:underline">
            Upgrade now →
          </a>
        </div>
      )}

      {profileIncomplete && !hideProfileBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-amber-500" aria-hidden="true">
              ⚠
            </span>
            <div>
              <p className="text-sm font-medium text-amber-800">Complete your profile for better matches</p>
              <a href="/profile" className="text-xs text-amber-600 hover:underline">
                Update profile →
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHideProfileBanner(true)}
            className="text-amber-400 hover:text-amber-600 text-lg"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-[2]">
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-[#6b7280]"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M21 21l-4.3-4.3m1.8-5.2a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-14 py-2 text-sm rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] focus:outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent placeholder-[#9ca3af]"
              placeholder="Search grants and funders..."
            />
            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1.5 text-xs text-[#6b7280] hover:text-[#1a1f2e] font-medium"
                aria-label="Clear search"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1">
            <select
              value={band === "ALL" ? "" : band}
              onChange={(e) => setBand((e.target.value ? (e.target.value as ScoreBand) : "ALL") as ScoreBand)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            >
              <option value="">All scores</option>
              <option value="HIGH">HIGH fit</option>
              <option value="MEDIUM">MEDIUM fit</option>
              <option value="LOW">LOW fit</option>
            </select>
          </div>

          <div className="flex-1">
            <select
              value={funder === "ALL" ? "" : funder}
              onChange={(e) => setFunder(e.target.value ? e.target.value : "ALL")}
              className="w-full py-2 px-3 text-sm rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            >
              <option value="">All funders</option>
              {funderOptions
                .filter((f) => f !== "ALL")
                .map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex-1">
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full py-2 px-3 text-sm rounded-lg border border-[#e8e3da] bg-white text-[#1a1f2e] focus:outline-none focus:ring-2 focus:ring-[#c9923a]"
            >
              <option value="FIT">Fit Score</option>
              <option value="DEADLINE">Deadline</option>
              <option value="EV">Est. Value</option>
            </select>
          </div>
        </div>

        <div className="mt-2 text-right">
          <span className="text-xs text-[#6b7280]">{filteredSorted.length} shown</span>
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "#fff", border: `1px solid ${BORDER}` }}
        >
          <p className="mb-2 text-[#1a1f2e]">
            No opportunities match your filters.
          </p>
          <p className="text-sm text-[#6b7280]">
            Try widening the score band or selecting a different funder.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSorted.map((row, i) => (
            <OpportunityRow key={row.id} rank={i + 1} plan={plan} pipelineCount={pipelineCount} {...row} />
          ))}
        </div>
      )}
    </div>
  );
}

