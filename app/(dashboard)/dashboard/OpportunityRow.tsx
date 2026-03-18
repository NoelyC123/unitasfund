"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanId } from "@/lib/stripe/plans";
import { pipelineLimitReached } from "@/lib/stripe/gate";

function formatEv(ev: number | null): string {
  if (ev == null || Number.isNaN(ev)) return "—";
  const n = Math.round(ev);
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  return `£${n.toLocaleString("en-GB")}`;
}

function formatDeadline(d: string | null): string {
  if (!d || !d.trim()) return "Rolling";
  const date = new Date(d.trim());
  if (Number.isNaN(date.getTime())) return d;
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function daysUntilDeadline(d: string | null): number | null {
  if (!d || !d.trim()) return null;
  const date = new Date(d.trim());
  const t = date.getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function lastCheckedText(lastCheckedAt?: string | null): string | null {
  if (!lastCheckedAt || !lastCheckedAt.trim()) return "Not yet verified";
  const d = new Date(lastCheckedAt);
  const t = d.getTime();
  if (Number.isNaN(t)) return "Not yet verified";
  const diffDays = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return null;
  if (diffDays <= 7) return `Checked ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  return `Last checked ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

type ScoreBand = "HIGH" | "MEDIUM" | "LOW";
function bandFor(score: number): ScoreBand {
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export default function OpportunityRow(props: {
  rank: number;
  id: string;
  title: string;
  funder_name: string | null;
  fit_score: number;
  deadline: string | null;
  ev: number | null;
  last_checked_at?: string | null;
  match_reasons?: string[];
  plan: PlanId;
  pipelineCount: number;
}) {
  const router = useRouter();
  const [showWhyScore, setShowWhyScore] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const band = bandFor(props.fit_score);
  const funderInitial = (props.funder_name?.trim()?.[0] ?? "U").toUpperCase();
  const daysUntil = daysUntilDeadline(props.deadline);
  const deadlineText = formatDeadline(props.deadline);
  const formattedEV = formatEv(props.ev);
  const lcText = lastCheckedText(props.last_checked_at);

  const isFree = props.plan === "free";
  const pipelineLocked = useMemo(() => {
    if (!isFree) return false;
    return pipelineLimitReached({ plan: props.plan, pipelineCount: props.pipelineCount });
  }, [isFree, props.plan, props.pipelineCount]);

  async function addToPipeline() {
    if (pipelineLocked) return;
    setAdding(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity_id: props.id }),
      });
      if (res.ok) setAdded(true);
    } finally {
      setAdding(false);
    }
  }

  function handleCardClick() {
    router.push(`/opportunity/${props.id}`);
  }

  function handleWhyScore(e: React.MouseEvent) {
    e.stopPropagation();
    setShowWhyScore((v) => !v);
  }

  async function handleAddToPipeline(e: React.MouseEvent) {
    e.stopPropagation();
    await addToPipeline();
  }

  const matchReasons = props.match_reasons ?? [];
  const showReasons = showWhyScore && matchReasons.length > 0;

  const cardStyle: React.CSSProperties = {
    backgroundColor: "white",
    borderRadius: "16px",
    border: "1px solid #ece6dd",
    boxShadow: hovered
      ? "0 4px 20px rgba(26,31,46,0.10)"
      : "0 1px 4px rgba(26,31,46,0.06), 0 0 0 0 transparent",
    transform: hovered ? "translateY(-1px)" : "translateY(0)",
    transition: "box-shadow 0.2s ease, transform 0.2s ease",
    padding: "20px 24px",
    marginBottom: "12px",
    cursor: "pointer",
  };

  return (
    <div
      onClick={() => router.push(`/opportunity/${props.id}`)}
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-white rounded-xl border border-[#e8e3da] shadow-sm hover:shadow-md transition-all duration-200 p-5 group"
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleCardClick();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="text-xs text-[#9ca3af] w-5 pt-1 flex-shrink-0 font-mono">{props.rank}</span>

          <div
            style={{
              width: "40px",
              height: "40px",
              minWidth: "40px",
              minHeight: "40px",
              borderRadius: "50%",
              backgroundColor: "#c9923a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                color: "white",
                fontWeight: "bold",
                fontSize: "14px",
                lineHeight: 1,
              }}
            >
              {funderInitial}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h3
              style={{
                fontFamily: "var(--font-heading, Georgia, serif)",
                fontSize: "15px",
                fontWeight: "600",
                color: "#1a1f2e",
                lineHeight: "1.3",
                marginBottom: "2px",
                letterSpacing: "-0.01em",
              }}
            >
              {props.title}
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body, DM Sans, sans-serif)",
                fontSize: "13px",
                color: "#6b7f95",
                fontWeight: "400",
                marginTop: "2px",
              }}
            >
              {props.funder_name ?? ""}
            </p>
            {lcText && <p className="text-xs text-[#9ca3af] mt-0.5">{lcText}</p>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              band === "HIGH"
                ? "bg-green-100 text-green-800"
                : band === "MEDIUM"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-gray-100 text-gray-600"
            }`}
            style={{
              fontFamily: "var(--font-body, ui-sans-serif, system-ui, sans-serif)",
              fontSize: "11px",
              fontWeight: "600",
              letterSpacing: "0.04em",
              padding: "3px 10px",
              borderRadius: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            {Math.round(props.fit_score)}% {band}
          </span>

          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              daysUntil != null && daysUntil < 14
                ? "bg-red-100 text-red-700"
                : daysUntil != null && daysUntil < 30
                  ? "bg-amber-100 text-amber-700"
                  : props.deadline
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
            }`}
            style={{
              fontFamily: "var(--font-body, ui-sans-serif, system-ui, sans-serif)",
              fontSize: "11px",
              fontWeight: "600",
              letterSpacing: "0.04em",
              padding: "3px 10px",
              borderRadius: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            {deadlineText}
          </span>

          {props.ev != null && props.ev > 0 && (
            <span className="text-xs font-semibold text-[#c9923a]">{isFree ? `${formattedEV} — Upgrade` : formattedEV}</span>
          )}
        </div>
      </div>

      <div className="border-t border-[#f0ece4] mt-4 pt-3">
        <div className="flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowWhyScore((v) => !v);
            }}
            className="text-xs text-[#c9923a] hover:underline font-medium"
          >
            Why this score? ▾
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void addToPipeline();
            }}
            disabled={adding || added || pipelineLocked}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#1a1f2e] text-[#1a1f2e] font-medium hover:bg-[#1a1f2e] hover:text-white transition-colors duration-150 disabled:opacity-60"
          >
            {added ? "In pipeline" : pipelineLocked ? "Upgrade to add more" : adding ? "Adding…" : "+ Add to pipeline"}
          </button>
        </div>

        {showWhyScore && isFree && matchReasons.length > 0 && (
          <div className="mt-3 bg-[#f7f4ef] rounded-lg p-3">
            <p className="text-xs text-[#6b7280]">
              Upgrade to view full match reasons.
              <a
                href="/pricing"
                onClick={(e) => e.stopPropagation()}
                className="ml-2 text-[#c9923a] hover:underline font-medium"
              >
                View plans →
              </a>
            </p>
          </div>
        )}

        {showReasons && !isFree && (
          <div className="mt-3 bg-[#f7f4ef] rounded-lg p-3">
            <ul className="space-y-1.5">
              {matchReasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[#374151]">
                  <span className="text-[#c9923a] mt-0.5 flex-shrink-0">✓</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
