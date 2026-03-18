"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlanId } from "@/lib/stripe/plans";
import { pipelineLimitReached } from "@/lib/stripe/gate";

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
  amount_min?: number | null;
  amount_max?: number | null;
  source_id?: string | null;
  match_reasons?: string[];
  eligibility_certainty?: string | null;
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

function fitTier(score: number): { label: string; bg: string; text: string } {
  if (score >= 75) return { label: "HIGH", bg: "#f0fdf4", text: "#166534" };
  if (score >= 50) return { label: "MEDIUM", bg: "#fffbeb", text: "#92400e" };
  return { label: "LOW", bg: "#fef2f2", text: "#991b1b" };
}

function evBlockedSource(sourceId: string | null | undefined): boolean {
  const s = String(sourceId ?? "").toLowerCase().trim();
  return s === "tudor_trust" || s === "garfield_weston" || s === "lloyds_bank_foundation";
}

function isAwardValueUnreliable(row: ScoredOpportunity): boolean {
  const amountText = (row.amount_text ?? "").toLowerCase();
  if (amountText.includes("million")) return true;
  if (amountText.includes("budget")) return true;
  const max = row.amount_max ?? 0;
  if (max > 1_000_000) return true;
  return false;
}

function isInvitationOnly(row: ScoredOpportunity): boolean {
  const s = String(row.source_id ?? "").toLowerCase().trim();
  if (s === "tudor_trust") return true;
  const d = String(row.deadline ?? "").toLowerCase();
  return d.includes("invitation only");
}

function formatEv(ev: number | null): string {
  if (ev == null || Number.isNaN(ev)) return "—";
  const n = Math.round(ev);
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
  return `£${n.toLocaleString("en-GB")}`;
}

/** Get avatar initial and colour from source */
function sourceAvatar(
  funderName: string | null,
  sourceId: string | null
): { letter: string; bg: string; color: string } {
  const letter = (funderName ?? "?").charAt(0).toUpperCase();
  // Colour by source type
  if (sourceId?.includes("gov") || sourceId?.includes("find-funding"))
    return { letter, bg: "#f0fdf4", color: "#166534" };
  if (sourceId?.includes("lottery") || sourceId?.includes("nlcf"))
    return { letter, bg: "#eff6ff", color: "#1e40af" };
  if (sourceId?.includes("sport"))
    return { letter, bg: "#fdf4ff", color: "#7e22ce" };
  if (sourceId?.includes("arts"))
    return { letter, bg: "#fff7ed", color: "#c2410c" };
  // Default gold for community foundations etc.
  return { letter, bg: "#fef9ee", color: "#92400e" };
}

function eligibilityBadge(certainty: string | null | undefined): {
  label: string;
  bg: string;
  text: string;
} | null {
  if (!certainty) return null;
  if (certainty === "strong_match") return { label: "Strong Match ✓", bg: "#dcfce7", text: "#166534" };
  if (certainty === "likely_eligible") return { label: "Likely Eligible", bg: "#dbeafe", text: "#1e40af" };
  if (certainty === "check_eligibility") return { label: "Check Eligibility", bg: "#fef3c7", text: "#92400e" };
  if (certainty === "unlikely_match") return { label: "Unlikely Match", bg: "#f3f4f6", text: "#6b7280" };
  return null;
}

export default function OpportunityRow({
  row,
  plan,
  pipelineCount,
}: {
  row: ScoredOpportunity;
  plan: PlanId;
  pipelineCount: number;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isFree = plan === "free";
  const pipelineLocked = useMemo(() => {
    if (!isFree) return false;
    return pipelineLimitReached({ plan, pipelineCount });
  }, [isFree, plan, pipelineCount]);

  const breakdown = row.fit_breakdown ?? {};
  const loc = breakdown.location_score ?? 0;
  const sec = breakdown.sector_score ?? 0;
  const inc = breakdown.income_score ?? 0;
  const dead = breakdown.deadline_score ?? 0;
  const maxComponent = 25;
  const invitationOnly = isInvitationOnly(row);
  const tier = invitationOnly ? { label: "INFO", bg: "#f3f4f6", text: "#6b7280" } : fitTier(row.fit_score);
  const avatar = sourceAvatar(row.funder_name, row.source_id ?? null);
  const reasons = row.match_reasons ?? [];
  const elig = eligibilityBadge(row.eligibility_certainty);
  const evBlocked = evBlockedSource(row.source_id ?? null);
  const evUnreliable = isAwardValueUnreliable(row);
  const evTooHigh = (row.ev ?? 0) > 100_000;
  const evTooLow = row.ev != null && row.ev < 10;

  async function addToPipeline() {
    if (pipelineLocked) return;
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
      className="rounded-xl border overflow-hidden transition-all duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => router.push(`/opportunity/${row.id}`)}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") router.push(`/opportunity/${row.id}`);
      }}
      style={{
        backgroundColor: "#fff",
        borderColor: hovered ? "#c9923a40" : "#ece6dd",
        boxShadow: hovered ? "0 2px 12px rgba(201, 146, 58, 0.08)" : "none",
        cursor: "pointer",
      }}
    >
      {/* Main card content */}
      <div className="px-6 py-5">
        {invitationOnly && (
          <div
            className="rounded-xl border px-4 py-3 mb-4"
            style={{ borderColor: "#f59e0b", backgroundColor: "#fffbeb", color: "#92400e" }}
          >
            <p className="text-sm font-semibold">
              This funder is invitation-only. They do not accept unsolicited applications.
            </p>
          </div>
        )}
        <div className="flex items-start gap-4">
          {/* Source avatar */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-semibold"
            style={{ backgroundColor: avatar.bg, color: avatar.color }}
            aria-hidden="true"
          >
            {avatar.letter}
          </div>

          {/* Title and source */}
          <div className="min-w-0 flex-1">
            <div
              className="font-semibold block leading-snug"
              style={{
                color: NAVY,
                fontFamily: "var(--font-heading, Georgia, serif)",
                fontSize: "1.05rem",
              }}
            >
              {row.title}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {row.funder_name && (
                <Link
                  href={`/funder/${encodeURIComponent(row.funder_name)}`}
                  className="text-sm hover:underline"
                  style={{ color: "#4a5568" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.funder_name}
                </Link>
              )}
              {elig && (
                <span
                  className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: elig.bg, color: elig.text }}
                >
                  {elig.label}
                </span>
              )}
            </div>
          </div>

          {/* Score + amount + deadline */}
          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
            <span
              className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: tier.bg, color: tier.text }}
            >
              {Math.round(row.fit_score)}% {tier.label}
            </span>
            {row.amount_text && (
              <span className="text-sm font-semibold" style={{ color: GOLD }}>
                {row.amount_text}
              </span>
            )}
            <span className="text-xs" style={{ color: "#6b7280" }}>
              {formatDeadline(row.deadline)}
            </span>
          </div>
        </div>

        {/* EV row (if available) */}
        {row.ev != null && !invitationOnly && !evBlocked && !evTooLow && (
          <div className="mt-3 ml-14 text-sm" style={{ color: "#6b7280" }}>
            Expected value:{" "}
            <span className="font-semibold" style={{ color: NAVY }}>
              {evUnreliable
                ? "EV not available — award amount may reflect total programme budget, not individual grant size"
                : evTooHigh
                  ? "EV estimate unavailable"
                  : row.ev != null && row.ev > 0 && row.ev < 50
                    ? "EV not available — award amount data insufficient."
                    : isFree
                      ? `${formatEv(row.ev)} — Upgrade`
                      : formatEv(row.ev)}
            </span>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-t"
        style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors"
          style={{
            color: GOLD,
            borderColor: "#ece6dd",
            backgroundColor: expanded ? "#fef9ee" : "transparent",
          }}
          aria-expanded={expanded}
        >
          Why this score?
          <span
            className="inline-block transition-transform text-xs"
            style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          >
            ▼
          </span>
        </button>

        <div className="ml-auto flex items-center gap-3">
          {pipelineLocked && (
            <a href="/pricing" className="text-xs font-medium hover:underline" style={{ color: GOLD }}>
              Upgrade to add more
            </a>
          )}
          {!invitationOnly && (
            <button
              type="button"
              onClick={addToPipeline}
              disabled={adding || added || pipelineLocked}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
              style={{
                backgroundColor: added ? "#166534" : GOLD,
                color: "#fff",
              }}
            >
              {added ? "✓ In pipeline" : adding ? "Adding…" : "+ Add to pipeline"}
            </button>
          )}
        </div>
      </div>

      {/* Expanded score breakdown */}
      {expanded && (
        <div
          className="px-6 py-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm"
          style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5" }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { label: "Location", score: loc },
            { label: "Sector", score: sec },
            { label: "Income", score: inc },
            { label: "Deadline", score: dead },
          ].map(({ label, score }) => (
            <div key={label}>
              <span className="block text-xs mb-1" style={{ color: "#6b7280" }}>
                {label}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#e5e7eb" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(score / maxComponent) * 100}%`,
                      backgroundColor:
                        score >= 20 ? "#22c55e" : score >= 12 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums" style={{ color: NAVY }}>
                  {score}/{maxComponent}
                </span>
              </div>
            </div>
          ))}

          {reasons.length > 0 && (
            <div className="col-span-2 sm:col-span-4 mt-2">
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "#fff", border: "1px solid #ece6dd" }}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: GOLD }}>
                  Reasons
                </p>
                <ul className="text-sm space-y-1.5" style={{ color: "#374151" }}>
                  {reasons.slice(0, isFree ? 2 : reasons.length).map((r, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span style={{ color: GOLD }}>•</span>
                      <span style={{ filter: isFree ? "blur(4px)" : "none" }}>{r}</span>
                    </li>
                  ))}
                </ul>
                {isFree && (
                  <p className="text-xs mt-2" style={{ color: "#6b7280" }}>
                    Upgrade to view full match reasons.{" "}
                    <a href="/pricing" className="font-medium hover:underline" style={{ color: GOLD }}>
                      View plans →
                    </a>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
