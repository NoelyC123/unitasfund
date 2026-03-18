"use client";

import { useMemo, useState } from "react";
import type { PlanId } from "@/lib/stripe/plans";
import { pipelineLimitReached } from "@/lib/stripe/gate";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const BORDER = "#e8e3da";
const BODY = "#374151";
const MUTED = "#6b7280";
const COMPONENT_MAX = 25;

const VALID_STATUSES = ["interested", "applying", "submitted", "won", "lost"] as const;
type PipelineStatus = (typeof VALID_STATUSES)[number];

type FitBreakdown = {
  location_score?: number;
  sector_score?: number;
  income_score?: number;
  deadline_score?: number;
};

function fitPriorityLabel(score: number): { label: string; bg: string; text: string } {
  if (score >= 75) return { label: "HIGH", bg: "#dcfce7", text: "#166534" };
  if (score >= 50) return { label: "MEDIUM", bg: "#fef3c7", text: "#92400e" };
  return { label: "LOW", bg: "#fee2e2", text: "#991b1b" };
}

function confidenceUi(level: "HIGH" | "MEDIUM" | "LOW"): { dot: string; label: string; note: string } {
  if (level === "HIGH") return { dot: "#22c55e", label: "HIGH", note: "Based on verified funder data" };
  if (level === "MEDIUM") return { dot: "#f59e0b", label: "MEDIUM", note: "Based on partial data" };
  return { dot: "#9ca3af", label: "LOW", note: "Limited data — check funder website" };
}

function statusLabel(s: PipelineStatus): string {
  if (s === "interested") return "Interested";
  if (s === "applying") return "Applying";
  if (s === "submitted") return "Submitted";
  if (s === "won") return "Won";
  return "Lost";
}

function statusUi(s: PipelineStatus): { bg: string; text: string; border: string } {
  if (s === "won") return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
  if (s === "lost") return { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" };
  if (s === "submitted") return { bg: "#e0f2fe", text: "#075985", border: "#bae6fd" };
  if (s === "applying") return { bg: "#fef3c7", text: "#92400e", border: "#fde68a" };
  return { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" };
}

function clampNotes(v: string): string {
  return v.slice(0, 1000);
}

function formatDeadline(d: string | null): string {
  if (!d || !d.trim()) return "Rolling";
  const date = new Date(d.trim());
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
  if (diffDays < 30) return { label: formatDeadline(deadline), bg: "#fef3c7", text: "#92400e" };
  return { label: formatDeadline(deadline), bg: "#dcfce7", text: "#166534" };
}

function amountLabel(args: {
  amount_text: string | null;
  amount_min: number | null;
  amount_max: number | null;
}): string {
  const t = args.amount_text?.trim();
  if (t) return t;
  const min = args.amount_min;
  const max = args.amount_max;
  if (min != null && max != null) {
    const a = Math.round(min);
    const b = Math.round(max);
    return `£${Math.min(a, b).toLocaleString("en-GB")} – £${Math.max(a, b).toLocaleString("en-GB")}`;
  }
  if (min != null) return `£${Math.round(min).toLocaleString("en-GB")}`;
  if (max != null) return `£${Math.round(max).toLocaleString("en-GB")}`;
  return "Not specified";
}

function formatMoneyGBP(n: number): string {
  const v = Math.round(n);
  return `£${v.toLocaleString("en-GB")}`;
}

function confidenceLevel(args: {
  confidence_score: number | null;
  amount_min: number | null;
  deadline: string | null;
  eligibility_summary: string | null;
  description: string | null;
  amount_text: string | null;
}): "HIGH" | "MEDIUM" | "LOW" {
  const cs = args.confidence_score ?? 0;
  if (
    cs >= 80 ||
    (args.amount_min != null && Boolean(args.deadline?.trim()) && Boolean(args.eligibility_summary?.trim()))
  ) {
    return "HIGH";
  }
  if (cs >= 50 || (Boolean(args.description?.trim()) && Boolean(args.amount_text?.trim()))) {
    return "MEDIUM";
  }
  return "LOW";
}

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

export default function OpportunityDetailClient(props: {
  organisationId: string;
  opportunityId: string;
  plan: PlanId;
  pipelineCount: number;
  title: string;
  funder_name: string | null;
  url: string | null;
  description: string | null;
  eligibility_summary: string | null;
  deadline: string | null;
  amount_text: string | null;
  amount_min: number | null;
  amount_max: number | null;
  fit_score: number;
  fit_breakdown: FitBreakdown;
  ev: number | null;
  bid_cost_estimate: number | null;
  confidence_score: number | null;
  match_reasons: string[];
  initialPipeline: null | { id: string; status: PipelineStatus; notes: string | null };
  similar: Array<{
    opportunity_id: string;
    fit_score: number;
    title: string;
    funder_name: string | null;
    deadline: string | null;
  }>;
}) {
  const [pipeline, setPipeline] = useState(props.initialPipeline);
  const [adding, setAdding] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const [notes, setNotes] = useState<string>(props.initialPipeline?.notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  const fitScore = props.fit_score;
  const priority = fitPriorityLabel(fitScore);
  const deadlineUi = deadlineBadge(props.deadline);

  const confidence = useMemo(() => {
    return confidenceLevel({
      confidence_score: props.confidence_score,
      amount_min: props.amount_min,
      deadline: props.deadline,
      eligibility_summary: props.eligibility_summary,
      description: props.description,
      amount_text: props.amount_text,
    });
  }, [
    props.confidence_score,
    props.amount_min,
    props.deadline,
    props.eligibility_summary,
    props.description,
    props.amount_text,
  ]);

  const bidHours = useMemo(() => {
    if (props.bid_cost_estimate == null || !Number.isFinite(props.bid_cost_estimate)) return null;
    const hrs = props.bid_cost_estimate / 45;
    if (!Number.isFinite(hrs) || hrs <= 0) return null;
    return Math.max(0, roundToNearest5(hrs));
  }, [props.bid_cost_estimate]);

  const componentPercents = useMemo(() => {
    const b = props.fit_breakdown ?? {};
    const toPct = (v: number | undefined) => Math.round(((v ?? 0) / COMPONENT_MAX) * 100);
    return {
      location: toPct(b.location_score),
      sector: toPct(b.sector_score),
      income: toPct(b.income_score),
      deadline: toPct(b.deadline_score),
    };
  }, [props.fit_breakdown]);

  const inPipeline = Boolean(pipeline?.id);
  const currentStatus = (pipeline?.status ?? "interested") as PipelineStatus;
  const statusChip = statusUi(currentStatus);

  const notesDirty = useMemo(() => (pipeline?.notes ?? "") !== notes, [pipeline?.notes, notes]);
  const isFree = props.plan === "free";
  const reasonsLocked = isFree;
  const evLocked = isFree;
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
        body: JSON.stringify({ opportunity_id: props.opportunityId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return;
      const p = json?.pipeline;
      if (p?.id) {
        setPipeline({
          id: String(p.id),
          status: (p.status as PipelineStatus) ?? "interested",
          notes: (p.notes as string | null) ?? "",
        });
        setNotes((p.notes as string | null) ?? "");
      }
    } finally {
      setAdding(false);
    }
  }

  async function updateStatus(next: PipelineStatus) {
    if (!pipeline?.id) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/pipeline/${pipeline.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) setPipeline((p) => (p ? { ...p, status: next } : p));
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveNotes() {
    if (!pipeline?.id) return;
    if (!notesDirty) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/pipeline/${pipeline.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) setPipeline((p) => (p ? { ...p, notes } : p));
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT */}
        <div className="lg:col-span-2">
          <LinkBack />

          <div className="rounded-xl border p-6 mb-6" style={{ backgroundColor: "#ffffff", borderColor: BORDER }}>
            <h1
              style={{
                fontFamily: "var(--font-heading, Georgia, serif)",
                fontSize: "30px",
                fontWeight: 700,
                color: NAVY,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {props.title}
            </h1>
            {props.funder_name && (
              <p
                style={{
                  fontFamily: "var(--font-body, DM Sans, sans-serif)",
                  marginTop: "6px",
                  fontSize: "16px",
                  color: "#6b7f95",
                  fontWeight: 400,
                  lineHeight: 1.5,
                }}
              >
                {props.funder_name}
              </p>
            )}
          </div>

          <SectionCard title="Description">
            {props.description?.trim() ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: BODY }}>
                {props.description}
              </p>
            ) : (
              <div className="rounded-lg border p-4" style={{ borderColor: BORDER, backgroundColor: CREAM }}>
                <p className="text-sm font-semibold" style={{ color: NAVY }}>
                  Full details available at the funder&apos;s website.
                </p>
                {props.url && (
                  <a
                    href={props.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm font-semibold hover:underline"
                    style={{ color: GOLD }}
                  >
                    View on funder&apos;s website →
                  </a>
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Who can apply">
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: BODY }}>
              {props.eligibility_summary?.trim()
                ? props.eligibility_summary
                : "Check the funder’s website for eligibility criteria."}
            </p>
          </SectionCard>

          <SectionCard title="About funder">
            <p className="text-sm font-medium" style={{ color: NAVY }}>
              {props.funder_name ?? "—"}
            </p>
            {props.url && (
              <a
                href={props.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-sm font-semibold hover:underline"
                style={{ color: GOLD }}
              >
                View on funder&apos;s website →
              </a>
            )}

            <div className="mt-4">
              <ReportIssue opportunityId={props.opportunityId} navy={NAVY} gold={GOLD} />
            </div>
          </SectionCard>

          <SectionCard title="Your notes">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <p className="text-xs" style={{ color: MUTED }}>
                {inPipeline ? "Auto-saves when you click away." : "Add to pipeline to save notes."}
              </p>
              <p className="text-xs tabular-nums" style={{ color: MUTED }}>
                {notes.length}/1000
              </p>
            </div>
            {inPipeline ? (
              <>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(clampNotes(e.target.value))}
                  onBlur={saveNotes}
                  rows={6}
                  className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                  style={{ borderColor: BORDER, backgroundColor: "#ffffff", color: NAVY }}
                  placeholder="Add notes about eligibility, key dates, what you’ll include in the application…"
                />
                {savingNotes && (
                  <p className="mt-2 text-xs font-semibold" style={{ color: GOLD }}>
                    Saving…
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: MUTED }}>
                Add to pipeline to save notes.
              </p>
            )}
          </SectionCard>

          {props.similar.length > 0 && (
            <SectionCard title="You might also be interested in">
              <div className="space-y-3">
                {props.similar.map((o) => {
                  const p = fitPriorityLabel(o.fit_score);
                  const dUi = deadlineBadge(o.deadline);
                  return (
                    <a
                      key={o.opportunity_id}
                      href={`/opportunity/${o.opportunity_id}`}
                      className="block rounded-xl border p-4 hover:shadow-sm transition-shadow"
                      style={{ borderColor: BORDER, backgroundColor: "#ffffff" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold"
                          style={{ backgroundColor: GOLD, color: "#ffffff" }}
                          aria-hidden="true"
                        >
                          {(o.funder_name?.trim()?.[0] ?? "U").toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-snug line-clamp-2" style={{ color: NAVY }}>
                            {o.title}
                          </p>
                          <p className="text-sm truncate" style={{ color: MUTED }}>
                            {o.funder_name ?? "—"}
                          </p>
                        </div>
                        <div className="flex items-end gap-2 flex-col shrink-0">
                          <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: p.bg, color: p.text }}>
                            {Math.round(o.fit_score)}% {p.label}
                          </span>
                          <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: dUi.bg, color: dUi.text }}>
                            {dUi.label}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-4">
            <div className="rounded-xl border p-5" style={{ backgroundColor: "#ffffff", borderColor: BORDER }}>
              <div className="text-4xl font-bold tabular-nums" style={{ color: NAVY }}>
                {Math.round(fitScore)}%
              </div>
              <div className="mt-2">
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: priority.bg, color: priority.text }}>
                  {priority.label}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {(
                  [
                    { label: "Location", pct: componentPercents.location },
                    { label: "Sector", pct: componentPercents.sector },
                    { label: "Income", pct: componentPercents.income },
                    { label: "Deadline", pct: componentPercents.deadline },
                  ] as const
                ).map((c) => (
                  <div key={c.label} className="grid grid-cols-[72px_1fr_46px] items-center gap-3">
                    <span className="text-xs" style={{ color: MUTED }}>
                      {c.label}
                    </span>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#e5e7eb" }}>
                      <div className="h-full" style={{ width: `${Math.min(100, Math.max(0, c.pct))}%`, backgroundColor: GOLD }} />
                    </div>
                    <span className="text-xs tabular-nums text-right" style={{ color: MUTED }}>
                      {c.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {props.match_reasons.length > 0 && (
              <div className="rounded-xl border p-5" style={{ backgroundColor: "#ffffff", borderColor: BORDER }}>
                <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: GOLD }}>
                  Why we matched you
                </p>
                <div className="relative">
                  <ul className="text-sm space-y-2" style={{ color: BODY, filter: reasonsLocked ? "blur(4px)" : "none" }}>
                    {props.match_reasons.map((r, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span style={{ color: GOLD }}>•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  {reasonsLocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="rounded-xl border px-4 py-3 text-center max-w-md"
                        style={{ backgroundColor: CREAM, borderColor: BORDER }}
                      >
                        <p className="text-sm font-semibold" style={{ color: NAVY }}>
                          Upgrade to unlock full match reasons and EV detail.
                        </p>
                        <a href="/pricing" className="text-sm font-semibold hover:underline" style={{ color: GOLD }}>
                          View plans →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-xl border p-5" style={{ backgroundColor: "#ffffff", borderColor: BORDER }}>
              <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: GOLD }}>
                Key facts
              </p>
              <div className="divide-y" style={{ borderColor: BORDER }}>
                {[
                  { label: "Award", value: amountLabel({ amount_text: props.amount_text, amount_min: props.amount_min, amount_max: props.amount_max }) },
                  { label: "Deadline", value: deadlineUi.label, badge: { bg: deadlineUi.bg, text: deadlineUi.text } },
                  { label: "Funder", value: props.funder_name ?? "—" },
                ].map((row, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                    <div className="text-xs uppercase tracking-wider" style={{ color: "#9ca3af" }}>
                      {row.label}
                    </div>
                    {row.badge ? (
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: row.badge.bg, color: row.badge.text }}>
                        {row.value}
                      </span>
                    ) : (
                      <div className="text-sm font-medium text-right" style={{ color: NAVY }}>
                        {row.value}
                      </div>
                    )}
                  </div>
                ))}
                <div className="py-3 flex items-start justify-between gap-4">
                  <div className="text-xs uppercase tracking-wider" style={{ color: "#9ca3af" }}>
                    Source
                  </div>
                  {props.url ? (
                    <a href={props.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline" style={{ color: GOLD }}>
                      View original listing →
                    </a>
                  ) : (
                    <div className="text-sm font-medium" style={{ color: NAVY }}>
                      —
                    </div>
                  )}
                </div>
              </div>
            </div>

            {props.ev != null && props.ev > 0 && (
              <div className="rounded-xl border p-5" style={{ backgroundColor: "#ffffff", borderColor: BORDER }}>
                <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: GOLD }}>
                  Estimated net EV
                </p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: GOLD }}>
                  {evLocked ? `${formatMoneyGBP(props.ev)} — Upgrade to see full details` : formatMoneyGBP(props.ev)}
                </p>
                <p className="text-xs mt-2" style={{ color: MUTED }}>
                  win probability × award value − bid cost
                  {bidHours != null ? ` (assumes approx. ${bidHours} hrs to bid @ £45/hr)` : ""} — see funder site for full criteria
                </p>

                <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: NAVY, filter: evLocked ? "blur(3px)" : "none" }}>
                  {(() => {
                    const ui = confidenceUi(confidence);
                    return (
                      <>
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ui.dot }} aria-hidden="true" />
                        <span className="font-semibold">{ui.label}</span>
                        <span style={{ color: MUTED }}>{ui.note}</span>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            <div className="rounded-xl border p-5" style={{ backgroundColor: "#ffffff", borderColor: BORDER }}>
              <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: GOLD }}>
                Pipeline status
              </p>

              {!inPipeline ? (
                <button
                  type="button"
                  onClick={addToPipeline}
                  disabled={adding || pipelineLocked}
                  className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: GOLD, color: NAVY }}
                >
                  {pipelineLocked ? "Upgrade to add more" : adding ? "Adding…" : "Add to pipeline"}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border"
                    style={{ backgroundColor: statusChip.bg, color: statusChip.text, borderColor: statusChip.border }}
                  >
                    {statusLabel(currentStatus)}
                  </span>
                  <select
                    value={currentStatus}
                    onChange={(e) => updateStatus(e.target.value as PipelineStatus)}
                    disabled={savingStatus}
                    className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                    style={{ borderColor: BORDER, backgroundColor: "#ffffff", color: NAVY }}
                  >
                    <option value="interested">Interested</option>
                    <option value="applying">Applying</option>
                    <option value="submitted">Submitted</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              )}
            </div>

            {props.url && (
              <a
                href={props.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                View on funder’s website →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkBack() {
  return (
    <div className="mb-4">
      <a href="/dashboard" className="text-sm font-semibold hover:underline" style={{ color: GOLD }}>
        ← Dashboard
      </a>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-6 mb-6" style={{ backgroundColor: "#ffffff", borderColor: BORDER }}>
      <p
        className="uppercase tracking-wider mb-3"
        style={{
          fontFamily: "var(--font-body, DM Sans, sans-serif)",
          fontSize: "12px",
          fontWeight: 600,
          color: GOLD,
          letterSpacing: "0.12em",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

function ReportIssue(props: { opportunityId: string; navy: string; gold: string }) {
  const [open, setOpen] = useState(false);
  const [issueType, setIssueType] = useState<string>("incorrect_information");
  const [desc, setDesc] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${props.opportunityId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue_type: issueType,
          description: desc,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Failed to submit issue.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit issue.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm" style={{ color: "#166534" }}>
        Thank you — we&apos;ll review this shortly.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="text-sm hover:underline font-semibold"
        style={{ color: props.gold }}
        onClick={() => setOpen((v) => !v)}
      >
        Report an issue
      </button>
      {open && (
        <div className="mt-3 rounded-xl border p-4" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: props.gold }}>
                Issue type
              </span>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: props.navy }}
              >
                <option value="incorrect_information">Incorrect information</option>
                <option value="closed_or_expired">Grant is closed or expired</option>
                <option value="wrong_eligibility">Wrong eligibility criteria</option>
                <option value="broken_link">Broken link</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <label className="mt-3 block space-y-1">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: props.gold }}>
              Description (optional)
            </span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="Tell us what's wrong..."
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: props.navy }}
            />
          </label>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: props.gold, color: props.navy }}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
            {error && (
              <span className="text-sm" style={{ color: "#b91c1c" }}>
                {error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

