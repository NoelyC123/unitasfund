"use client";

import { useMemo, useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
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

export default function OpportunityDetailClient(props: {
  organisationId: string;
  opportunityId: string;
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

  async function addToPipeline() {
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
    <div className="pb-12">
      <div className="flex flex-col md:flex-row gap-6">
        {/* RIGHT column first on mobile */}
        <aside className="order-1 md:order-2 md:w-1/3">
          <div className="md:sticky md:top-6 space-y-4">
            <div className="rounded-xl border p-5" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
              <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: GOLD }}>
                Fit score
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-3xl font-bold tabular-nums" style={{ color: NAVY }}>
                  {Math.round(fitScore)}%
                </span>
                <span
                  className="text-xs font-semibold px-2 py-1 rounded"
                  style={{ backgroundColor: priority.bg, color: priority.text }}
                >
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
                  <div key={c.label} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold" style={{ color: NAVY }}>
                        {c.label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: NAVY }}>
                        {c.pct}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: NAVY }}>
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, c.pct))}%`,
                          backgroundColor: GOLD,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {props.match_reasons.length > 0 && (
              <div className="rounded-xl border p-5" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: GOLD }}>
                  Why we matched you to this grant
                </p>
                <ul className="text-sm space-y-2" style={{ color: NAVY }}>
                  {props.match_reasons.map((r, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span style={{ color: GOLD }}>•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border p-5" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: GOLD }}>
                Key facts
              </p>
              <div className="space-y-3 text-sm" style={{ color: NAVY }}>
                <div className="flex items-start justify-between gap-3">
                  <span style={{ color: "#6b7280" }}>Award</span>
                  <span className="font-semibold text-right">
                    {amountLabel({
                      amount_text: props.amount_text,
                      amount_min: props.amount_min,
                      amount_max: props.amount_max,
                    })}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span style={{ color: "#6b7280" }}>Deadline</span>
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded h-fit"
                    style={{ backgroundColor: deadlineUi.bg, color: deadlineUi.text }}
                  >
                    {deadlineUi.label}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span style={{ color: "#6b7280" }}>Funder</span>
                  <span className="font-semibold text-right">{props.funder_name ?? "—"}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span style={{ color: "#6b7280" }}>Source</span>
                  {props.url ? (
                    <a
                      href={props.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold hover:underline text-right"
                      style={{ color: GOLD }}
                    >
                      View original listing →
                    </a>
                  ) : (
                    <span className="font-semibold">—</span>
                  )}
                </div>
              </div>
            </div>

            {props.ev != null && props.ev > 0 && (
              <div className="rounded-xl border p-5" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: GOLD }}>
                  Expected value
                </p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: NAVY }}>
                  {formatMoneyGBP(props.ev)}
                </p>
                <p className="text-xs" style={{ color: "#6b7280" }}>
                  win probability × award value − bid cost
                </p>
              </div>
            )}

            <div className="rounded-xl border p-5" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: GOLD }}>
                Pipeline status
              </p>

              {!inPipeline ? (
                <button
                  type="button"
                  onClick={addToPipeline}
                  disabled={adding}
                  className="w-full px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: GOLD, color: NAVY }}
                >
                  {adding ? "Adding…" : "Add to pipeline"}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded border"
                    style={{
                      backgroundColor: statusChip.bg,
                      color: statusChip.text,
                      borderColor: statusChip.border,
                    }}
                  >
                    {statusLabel(currentStatus)}
                  </span>
                  <select
                    value={currentStatus}
                    onChange={(e) => updateStatus(e.target.value as PipelineStatus)}
                    disabled={savingStatus}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5", color: NAVY }}
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
                className="w-full inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
                style={{ backgroundColor: GOLD, color: NAVY }}
              >
                View on funder’s website →
              </a>
            )}
          </div>
        </aside>

        {/* LEFT column */}
        <div className="order-2 md:order-1 md:w-2/3 space-y-6">
          <div>
            <a href="/dashboard" className="text-sm hover:underline" style={{ color: GOLD }}>
              ← Dashboard
            </a>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#fff", borderColor: "#ece6dd" }}>
            <div className="px-6 py-5 border-b" style={{ backgroundColor: NAVY, borderColor: "#2d3345" }}>
              <h1 className="text-2xl font-bold" style={{ color: CREAM }}>
                {props.title}
              </h1>
              {props.funder_name && (
                <p className="mt-1 text-sm" style={{ color: "#a8b4c4" }}>
                  {props.funder_name}
                </p>
              )}
            </div>

            <div className="px-6 py-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
                  Description
                </h2>
                {props.description?.trim() ? (
                  <div
                    className="rounded-lg border p-4 text-sm whitespace-pre-wrap"
                    style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: "#374151" }}
                  >
                    {props.description}
                  </div>
                ) : (
                  <div
                    className="rounded-lg border p-4 text-sm"
                    style={{ borderColor: "#fde68a", backgroundColor: "#fff7ed", color: NAVY }}
                  >
                    <p className="font-semibold mb-1">Full details available at the funder&apos;s website.</p>
                    {props.url && (
                      <a
                        href={props.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline font-semibold"
                        style={{ color: GOLD }}
                      >
                        View on funder&apos;s website →
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
                  Who can apply
                </h2>
                <div
                  className="rounded-lg border p-4 text-sm whitespace-pre-wrap"
                  style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: "#374151" }}
                >
                  {props.eligibility_summary?.trim()
                    ? props.eligibility_summary
                    : "Check the funder’s website for eligibility criteria."}
                </div>
              </div>

              <div className="rounded-xl border p-5" style={{ borderColor: "#ece6dd", backgroundColor: "#faf8f5" }}>
                <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: GOLD }}>
                  About this funder
                </p>
                <p className="text-sm font-semibold" style={{ color: NAVY }}>
                  {props.funder_name ?? "—"}
                </p>
                {props.url && (
                  <a
                    href={props.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm hover:underline font-semibold"
                    style={{ color: GOLD }}
                  >
                    View on funder&apos;s website →
                  </a>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-lg font-bold" style={{ color: NAVY }}>
                    Your notes
                  </h2>
                  <p className="text-xs tabular-nums" style={{ color: "#6b7280" }}>
                    {notes.length}/1000
                  </p>
                </div>
                {inPipeline ? (
                  <>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(clampNotes(e.target.value))}
                      onBlur={saveNotes}
                      rows={7}
                      className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: "#ece6dd", backgroundColor: "#fff", color: NAVY }}
                      placeholder="Add notes about eligibility, key dates, what you’ll include in the application…"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs" style={{ color: "#6b7280" }}>
                        Auto-saves when you click away.
                      </p>
                      {savingNotes && (
                        <span className="text-xs font-semibold" style={{ color: GOLD }}>
                          Saving…
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm" style={{ color: "#6b7280" }}>
                    Add to pipeline to save notes.
                  </p>
                )}
              </div>

              {props.similar.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold mb-3" style={{ color: NAVY }}>
                    You might also be interested in
                  </h2>
                  <div className="space-y-3">
                    {props.similar.map((o) => {
                      const p = fitPriorityLabel(o.fit_score);
                      const dUi = deadlineBadge(o.deadline);
                      return (
                        <a
                          key={o.opportunity_id}
                          href={`/opportunity/${o.opportunity_id}`}
                          className="block rounded-xl border px-4 py-3 hover:opacity-95"
                          style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold"
                              style={{ backgroundColor: GOLD, color: NAVY }}
                              aria-hidden="true"
                            >
                              {(o.funder_name?.trim()?.[0] ?? "U").toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold leading-snug line-clamp-2" style={{ color: NAVY }}>
                                {o.title}
                              </p>
                              <p className="text-sm truncate" style={{ color: "#4a5568" }}>
                                {o.funder_name ?? "—"}
                              </p>
                            </div>
                            <div className="flex items-end gap-2 flex-col shrink-0">
                              <span
                                className="text-xs font-semibold px-2 py-1 rounded"
                                style={{ backgroundColor: p.bg, color: p.text }}
                              >
                                {p.label} · {Math.round(o.fit_score)}%
                              </span>
                              <span
                                className="text-xs font-semibold px-2 py-1 rounded"
                                style={{ backgroundColor: dUi.bg, color: dUi.text }}
                              >
                                {dUi.label}
                              </span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

