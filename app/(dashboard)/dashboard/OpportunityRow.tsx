"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const BORDER = "#e8e3da";
const BODY = "#374151";
const MUTED = "#6b7280";
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
  source_id?: string | null;
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

function deadlineBadge(deadline: string | null): { label: string; bg: string; text: string } {
  if (!deadline || !deadline.trim()) {
    return { label: "Rolling", bg: "#e0f2fe", text: "#075985" };
  }
  const d = new Date(deadline.trim());
  const t = d.getTime();
  if (Number.isNaN(t)) return { label: deadline, bg: "#e5e7eb", text: "#374151" };
  const diffDays = (t - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 14) return { label: formatDeadline(deadline), bg: "#fee2e2", text: "#991b1b" };
  if (diffDays < 28) return { label: formatDeadline(deadline), bg: "#fef3c7", text: "#92400e" };
  return { label: formatDeadline(deadline), bg: "#dcfce7", text: "#166534" };
}

function fitBadge(score: number): { label: string; bg: string; text: string } {
  if (score >= 75) return { label: "HIGH", bg: "#dcfce7", text: "#166534" };
  if (score >= 50) return { label: "MEDIUM", bg: "#fef3c7", text: "#92400e" };
  return { label: "LOW", bg: "#e5e7eb", text: "#374151" };
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

function lastCheckedLabel(lastCheckedAt?: string | null): { text: string; color: string } | null {
  if (!lastCheckedAt || !lastCheckedAt.trim()) {
    return { text: "Not yet verified", color: "#6b7280" };
  }
  const d = new Date(lastCheckedAt);
  const t = d.getTime();
  if (Number.isNaN(t)) return { text: "Not yet verified", color: "#6b7280" };
  const diffDays = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return null; // within 24h: show nothing
  if (diffDays <= 7) return { text: `Checked ${diffDays} day${diffDays === 1 ? "" : "s"} ago`, color: "#6b7280" };
  return {
    text: `Last checked ${diffDays} day${diffDays === 1 ? "" : "s"} ago`,
    color: "#92400e",
  };
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
  const router = useRouter();
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
  const fitPill = fitBadge(row.fit_score);
  const deadlineUi = deadlineBadge(row.deadline);
  const lastChecked = lastCheckedLabel(row.last_checked_at);

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
      className="rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      style={{ backgroundColor: "#ffffff", borderColor: BORDER }}
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/opportunity/${row.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(`/opportunity/${row.id}`);
      }}
    >
      <div
        className="flex flex-wrap items-center gap-4 p-5"
        style={{ color: NAVY }}
      >
        <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: MUTED, width: "2.75rem" }}>
          #{row.rank}
        </span>
        <div
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold"
          style={{ backgroundColor: GOLD, color: "#ffffff" }}
          aria-hidden="true"
        >
          {(row.funder_name?.trim()?.[0] ?? "U").toUpperCase()}
        </div>
        <div className="min-w-0 flex-1 min-w-[200px]">
          <div className="font-semibold block truncate text-base" style={{ color: NAVY }}>
            {row.title}
          </div>
          {row.funder_name && (
            <p className="text-sm truncate mt-0.5" style={{ color: MUTED }}>
              {row.funder_name}
            </p>
          )}
          {lastChecked && (
            <p className="text-[11px] mt-1" style={{ color: lastChecked.color }}>
              {lastChecked.text}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-full tabular-nums"
            style={{ backgroundColor: fitPill.bg, color: fitPill.text }}
          >
            {Math.round(row.fit_score)}% {fitPill.label}
          </span>
          <span
            className="text-xs font-semibold px-3 py-1.5 rounded-full tabular-nums"
            style={{ backgroundColor: deadlineUi.bg, color: deadlineUi.text }}
          >
            {deadlineUi.label}
          </span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: GOLD }}>
            {formatEv(row.ev)}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-semibold hover:underline"
            style={{ color: GOLD }}
            aria-expanded={expanded}
            onClickCapture={(e) => e.stopPropagation()}
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
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-60 border"
            style={{
              backgroundColor: "#ffffff",
              color: NAVY,
              borderColor: NAVY,
            }}
            onClickCapture={(e) => e.stopPropagation()}
          >
            {added ? "In pipeline" : adding ? "Adding…" : "Add to pipeline"}
          </button>
        </div>
      </div>
      {expanded && (
        <div
          className="px-5 pb-5 border-t space-y-4 text-sm"
          style={{ borderColor: BORDER, backgroundColor: "#ffffff" }}
        >
          {COMPONENT_LABELS.map((label, i) => {
            const score = scores[i] ?? 0;
            const reason = reasons[i] ?? "No detail available.";
            const pct = Math.round((score / COMPONENT_MAX) * 100);
            const barColor = componentBarColour(score);
            return (
              <div key={label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: MUTED }}>
                    {label}
                  </span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: NAVY }}>
                    {Math.round(score)}/{COMPONENT_MAX}
                  </span>
                </div>
                <p className="text-sm" style={{ color: BODY, margin: 0 }}>
                  {reason}
                </p>
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
