"use client";

import { useMemo, useState } from "react";
import OpportunityRow from "./OpportunityRow";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";

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
}: {
  orgName: string;
  rows: Row[];
}) {
  const [band, setBand] = useState<ScoreBand>("ALL");
  const [funder, setFunder] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("FIT");

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
    if (band !== "ALL") out = out.filter((r) => bandFor(r.fit_score) === band);
    if (funder !== "ALL") out = out.filter((r) => (r.funder_name ?? "") === funder);

    out.sort((a, b) => {
      if (sortKey === "DEADLINE") return deadlineValue(a.deadline) - deadlineValue(b.deadline);
      if (sortKey === "EV") return (b.ev ?? -Infinity) - (a.ev ?? -Infinity);
      return b.fit_score - a.fit_score;
    });

    return out.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, band, funder, sortKey]);

  const topScore = filteredSorted[0]?.fit_score ?? 0;

  return (
    <div className="pb-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: NAVY }}>
          {orgName}
        </h1>
        <p className="text-sm" style={{ color: "#4a5568" }}>
          {totalMatched === 0
            ? "No grant opportunities matched yet."
            : `${totalMatched} ${totalMatched === 1 ? "opportunity" : "opportunities"} matched — ${highCount} HIGH fit. Top fit score: ${Math.round(topScore)}%.`}
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD }}>
            Score band
          </span>
          <select
            value={band}
            onChange={(e) => setBand(e.target.value as ScoreBand)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}
          >
            <option value="ALL">All</option>
            <option value="HIGH">HIGH (75%+)</option>
            <option value="MEDIUM">MEDIUM (50–74%)</option>
            <option value="LOW">LOW (&lt;50%)</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD }}>
            Funder
          </span>
          <select
            value={funder}
            onChange={(e) => setFunder(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm max-w-[260px]"
            style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}
          >
            {funderOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD }}>
            Sort
          </span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}
          >
            <option value="FIT">Fit score</option>
            <option value="DEADLINE">Deadline</option>
            <option value="EV">Est. value</option>
          </select>
        </label>
      </div>

      <div className="mb-6">
        <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: GOLD }}>
          Top matches
        </p>
        <h2 className="text-xl font-bold mb-1" style={{ color: NAVY }}>
          Grants (excluding tenders)
        </h2>
        <p className="text-sm" style={{ color: "#4a5568" }}>
          Filter and sort client-side. Add to your pipeline to track applications.
        </p>
      </div>

      {filteredSorted.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: "#fff", border: "1px solid #ece6dd" }}
        >
          <p className="mb-2" style={{ color: NAVY }}>
            No opportunities match your filters.
          </p>
          <p className="text-sm" style={{ color: "#4a5568" }}>
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

