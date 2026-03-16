"use client";

import { useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const COMPONENT_MAX = 25;

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
  match_reasons?: string[];
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

/** Bar colour for a single component (0–25). */
function componentBarColour(score: number): string {
  if (score >= 20) return "#22c55e";
  if (score >= 10) return "#f59e0b";
  return "#ef4444";
}

function formatEv(ev: number | null): string {
  if (ev == null || Number.isNaN(ev)) return "—";
  const n = Math.round(ev);
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  return `£${n.toLocaleString("en-GB")}`;
}

/** HIGH 75%+, MEDIUM 50–74%, LOW &lt;50% */
function fitPriorityLabel(score: number): { label: string; bg: string; text: string } {
  if (score >= 75) return { label: "HIGH", bg: "#dcfce7", text: "#166534" };
  if (score >= 50) return { label: "MEDIUM", bg: "#fef3c7", text: "#92400e" };
  return { label: "LOW", bg: "#fee2e2", text: "#991b1b" };
}

const COMPONENT_LABELS = ["Location", "Sector", "Income", "Deadline"] as const;

export default function OpportunityRow({
  row,
}: {
  row: ScoredOpportunity;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const breakdown = row.fit_breakdown ?? {};
  const scores = [
    breakdown.location_score ?? 0,
    breakdown.sector_score ?? 0,
    breakdown.income_score ?? 0,
    breakdown.deadline_score ?? 0,
  ];
  const reasons = row.match_reasons ?? [];

  const priority = fitPriorityLabel(row.fit_score);

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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold tabular-nums" style={{ color: NAVY }}>
                {Math.round(row.fit_score)}% fit
              </span>
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: priority.bg, color: priority.text }}
              >
                {priority.label}
              </span>
            </div>
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
          className="px-5 py-4 border-t space-y-4 text-sm"
          style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5" }}
        >
          {COMPONENT_LABELS.map((label, i) => {
            const score = scores[i] ?? 0;
            const reason = reasons[i] ?? "No detail available.";
            const pct = Math.round((score / COMPONENT_MAX) * 100);
            const barColor = componentBarColour(score);
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span style={{ color: "#6b7280", fontWeight: 600 }}>{label}</span>
                  <span className="tabular-nums" style={{ color: NAVY, fontWeight: 600 }}>
                    {Math.round(score)}/{COMPONENT_MAX}
                  </span>
                </div>
                <p style={{ color: NAVY, margin: 0 }}>{reason}</p>
                <div
                  className="h-2 rounded-full overflow-hidden max-w-xs"
                  style={{ backgroundColor: "#e5e7eb" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
