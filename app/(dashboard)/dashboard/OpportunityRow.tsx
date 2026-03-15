"use client";

import { useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

type FitBreakdown = {
  location_score?: number;
  sector_score?: number;
  income_score?: number;
  deadline_score?: number;
};

type ScoredOpportunity = {
  rank: number;
  id: string;
  title: string;
  funder_name: string | null;
  url: string | null;
  fit_score: number;
  fit_breakdown: FitBreakdown | null;
  ev: number | null;
  deadline: string | null;
  amount_text: string | null;
};

function formatDeadline(d: string | null): string {
  if (!d || !d.trim()) return "Rolling";
  const date = new Date(d.trim());
  if (Number.isNaN(date.getTime())) return d;
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function fitColour(score: number): string {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function formatEv(ev: number | null): string {
  if (ev == null || Number.isNaN(ev)) return "—";
  const n = Math.round(ev);
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  return `£${n.toLocaleString("en-GB")}`;
}

export default function OpportunityRow({
  row,
}: {
  row: ScoredOpportunity;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const breakdown = row.fit_breakdown ?? {};
  const loc = breakdown.location_score ?? 0;
  const sec = breakdown.sector_score ?? 0;
  const inc = breakdown.income_score ?? 0;
  const dead = breakdown.deadline_score ?? 0;
  const maxComponent = 25;

  async function addToPipeline() {
    setAdding(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: row.id }),
      });
      if (res.ok) setAdded(true);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: "#fff",
        borderColor: "#ece6dd",
      }}
    >
      <div
        className="flex flex-wrap items-center gap-4 px-5 py-4"
        style={{ color: NAVY }}
      >
        <span
          className="font-semibold tabular-nums shrink-0"
          style={{ color: GOLD, width: "2.5rem" }}
        >
          #{row.rank}
        </span>
        <div className="min-w-0 flex-1 min-w-[200px]">
          <a
            href={row.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline block truncate"
            style={{ color: NAVY }}
          >
            {row.title}
          </a>
          {row.funder_name && (
            <p className="text-sm truncate mt-0.5" style={{ color: "#4a5568" }}>
              {row.funder_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-5 shrink-0 flex-wrap">
          <div className="w-28">
            <div
              className="h-2.5 rounded-full overflow-hidden mb-1"
              style={{ backgroundColor: "#e5e7eb" }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, row.fit_score)}%`,
                  backgroundColor: fitColour(row.fit_score),
                }}
              />
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: NAVY }}>
              {Math.round(row.fit_score)}% fit
            </span>
          </div>
          <span className="w-28 text-right" style={{ color: NAVY, fontSize: "0.9rem" }}>
            <span style={{ color: "#6b7280" }}>Est. value: </span>
            <span className="font-semibold tabular-nums" style={{ color: GOLD }}>
              {formatEv(row.ev)}
            </span>
          </span>
          <span className="text-sm w-28 text-right" style={{ color: "#4a5568" }}>
            {formatDeadline(row.deadline)}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm font-medium hover:underline"
            style={{ color: GOLD }}
            aria-expanded={expanded}
          >
            {expanded ? "Hide details" : "Why this score?"}
            <span
              className="inline-block transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : "none" }}
            >
              ▼
            </span>
          </button>
          <button
            type="button"
            onClick={addToPipeline}
            disabled={adding || added}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{
              backgroundColor: added ? "#22c55e" : GOLD,
              color: added ? CREAM : NAVY,
            }}
          >
            {added ? "In pipeline" : adding ? "Adding…" : "Add to pipeline"}
          </button>
        </div>
      </div>
      {expanded && (
        <div
          className="px-5 py-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm"
          style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5" }}
        >
          <div>
            <span style={{ color: "#6b7280" }}>Location </span>
            <span style={{ color: NAVY, fontWeight: 600 }}>
              {loc}/{maxComponent}
            </span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Sector </span>
            <span style={{ color: NAVY, fontWeight: 600 }}>
              {sec}/{maxComponent}
            </span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Income </span>
            <span style={{ color: NAVY, fontWeight: 600 }}>
              {inc}/{maxComponent}
            </span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Deadline </span>
            <span style={{ color: NAVY, fontWeight: 600 }}>
              {dead}/{maxComponent}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
