"use client";

import { useMemo, useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const BORDER = "#e8e3da";
const BODY = "#374151";
const MUTED = "#6b7280";

const STATUS_OPTIONS = [
  { value: "interested", label: "Interested" },
  { value: "applying", label: "Applying" },
  { value: "submitted", label: "Submitted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;

type PipelineItem = {
  id: string;
  status: string;
  notes: string;
  actual_award_amount?: number | null;
  bid_hours_estimate?: number | null;
  loss_reason?: string | null;
  outcome_notes?: string | null;
  opportunity_id: string;
  title: string;
  funder_name: string | null;
  url: string | null;
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

export default function PipelineTable({ items }: { items: PipelineItem[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: items.length,
      interested: 0,
      applying: 0,
      submitted: 0,
      won: 0,
      lost: 0,
    };
    for (const it of items) {
      if (typeof it.status === "string" && it.status in c) c[it.status] += 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((i) => i.status === statusFilter);
  }, [items, statusFilter]);

  const statuses = [
    { key: "all", label: "Total", count: counts.all },
    { key: "interested", label: "Interested", count: counts.interested },
    { key: "applying", label: "Applying", count: counts.applying },
    { key: "submitted", label: "Submitted", count: counts.submitted },
    { key: "won", label: "Won", count: counts.won },
    { key: "lost", label: "Lost", count: counts.lost },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm p-4 mb-0">
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => {
            const active = statusFilter === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-[#1a1f2e] text-white shadow-sm"
                    : "bg-white border border-[#e8e3da] text-[#374151] hover:border-[#1a1f2e] hover:text-[#1a1f2e]"
                }`}
                type="button"
              >
                {s.label}
                <span className={`ml-1.5 text-xs ${active ? "text-white/70" : "text-[#9ca3af]"}`}>({s.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e8e3da] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#f7f4ef] border-b border-[#e8e3da]">
              <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                Grant
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                Funder
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                Status
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-[#6b7280] uppercase tracking-wider">
                Deadline
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece4]">
            {filtered.map((item) => (
              <PipelineRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PipelineRow({ item }: { item: PipelineItem }) {
  const [status, setStatus] = useState(item.status);
  const [updating, setUpdating] = useState(false);
  const [openOutcome, setOpenOutcome] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);

  const [actualAwardAmount, setActualAwardAmount] = useState<string>(
    item.actual_award_amount != null ? String(item.actual_award_amount) : ""
  );
  const [bidHours, setBidHours] = useState<string>(
    item.bid_hours_estimate != null ? String(item.bid_hours_estimate) : ""
  );
  const [lossReason, setLossReason] = useState<string>(item.loss_reason ?? "eligibility");
  const [outcomeNotes, setOutcomeNotes] = useState<string>(item.outcome_notes ?? "");

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/pipeline/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setStatus(newStatus);
    } finally {
      setUpdating(false);
    }
  }

  const showOutcome = status === "won" || status === "lost";

  async function saveOutcome() {
    setSavingOutcome(true);
    try {
      const payload: Record<string, unknown> = {
        bid_hours_estimate: bidHours ? Number(bidHours) : null,
        outcome_notes: outcomeNotes,
      };
      if (status === "won") {
        payload.actual_award_amount = actualAwardAmount ? Number(actualAwardAmount) : null;
        payload.loss_reason = null;
      } else if (status === "lost") {
        payload.loss_reason = lossReason;
        payload.actual_award_amount = null;
      }

      const res = await fetch(`/api/pipeline/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // No need to refetch; optimistic is fine for now.
      if (res.ok) setOpenOutcome(false);
    } finally {
      setSavingOutcome(false);
    }
  }

  return (
    <>
      <tr className="hover:bg-[#fafaf8] transition-colors">
        <td className="px-6 py-4">
          <a
            href={`/opportunity/${item.opportunity_id}`}
            className="text-sm font-medium text-[#1a1f2e] line-clamp-1 hover:underline"
          >
            {item.title}
          </a>
          {item.amount_text && (
            <p className="text-xs mt-1 text-[#6b7280]">
              {item.amount_text}
            </p>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-[#6b7280]">
          {item.funder_name ?? "—"}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-full border"
              style={{
                backgroundColor:
                  status === "won"
                    ? "#dcfce7"
                    : status === "lost"
                    ? "#fee2e2"
                    : status === "submitted"
                    ? "#e0e7ff"
                    : status === "applying"
                    ? "#e0f2fe"
                    : "#fff7ed",
                color:
                  status === "won"
                    ? "#166534"
                    : status === "lost"
                    ? "#991b1b"
                    : status === "submitted"
                    ? "#3730a3"
                    : status === "applying"
                    ? "#075985"
                    : "#92400e",
                borderColor: BORDER,
              }}
            >
              {STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status}
            </span>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updating}
              className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-60 outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
              style={{
                borderColor: BORDER,
                color: NAVY,
                backgroundColor: "#ffffff",
              }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {showOutcome && (
              <button
                type="button"
                onClick={() => setOpenOutcome((v) => !v)}
                className="text-xs font-semibold hover:underline"
                style={{ color: GOLD }}
              >
                {openOutcome ? "Hide outcome" : "Record outcome"}
              </button>
            )}
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="text-xs font-medium text-[#6b7280] tabular-nums">{formatDeadline(item.deadline)}</span>
        </td>
        <td className="px-6 py-4 text-right">
          <button
            type="button"
            onClick={() => setOpenOutcome((v) => !v)}
            className="text-xs text-[#c9923a] hover:underline font-medium"
          >
            Update →
          </button>
        </td>
      </tr>

      {showOutcome && openOutcome && (
        <tr className="border-b last:border-b-0" style={{ borderColor: BORDER }}>
          <td colSpan={5} className="px-6 py-4" style={{ backgroundColor: CREAM }}>
            <div className="rounded-xl border p-4" style={{ borderColor: BORDER, backgroundColor: "#fff" }}>
              <p className="text-sm font-semibold mb-1" style={{ color: NAVY }}>
                Help us improve your future matches
              </p>
              <p className="text-sm mb-4" style={{ color: MUTED }}>
                All fields are optional.
              </p>

              {status === "won" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: MUTED }}>
                      Actual award amount received (£)
                    </span>
                    <input
                      value={actualAwardAmount}
                      onChange={(e) => setActualAwardAmount(e.target.value)}
                      inputMode="decimal"
                      className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                      style={{ borderColor: BORDER, backgroundColor: "#fff", color: NAVY }}
                      placeholder="e.g. 5000"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: MUTED }}>
                      Estimated hours spent on bid
                    </span>
                    <input
                      value={bidHours}
                      onChange={(e) => setBidHours(e.target.value)}
                      inputMode="numeric"
                      className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                      style={{ borderColor: BORDER, backgroundColor: "#fff", color: NAVY }}
                      placeholder="e.g. 20"
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: MUTED }}>
                      Any notes?
                    </span>
                    <textarea
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                      style={{ borderColor: BORDER, backgroundColor: "#fff", color: NAVY }}
                      placeholder="What went well? What would you do differently?"
                    />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: MUTED }}>
                      Primary reason for loss
                    </span>
                    <select
                      value={lossReason}
                      onChange={(e) => setLossReason(e.target.value)}
                      className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                      style={{ borderColor: BORDER, backgroundColor: "#fff", color: NAVY }}
                    >
                      <option value="eligibility">Eligibility — we didn&apos;t meet the criteria</option>
                      <option value="competition">Competition — stronger applications</option>
                      <option value="capacity">Capacity — ran out of time</option>
                      <option value="timing">Timing — missed the window</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: MUTED }}>
                      Estimated hours spent on bid
                    </span>
                    <input
                      value={bidHours}
                      onChange={(e) => setBidHours(e.target.value)}
                      inputMode="numeric"
                      className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                      style={{ borderColor: BORDER, backgroundColor: "#fff", color: NAVY }}
                      placeholder="e.g. 10"
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: MUTED }}>
                      Any notes?
                    </span>
                    <textarea
                      value={outcomeNotes}
                      onChange={(e) => setOutcomeNotes(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#c9923a] focus:border-transparent"
                      style={{ borderColor: BORDER, backgroundColor: "#fff", color: NAVY }}
                      placeholder="Anything worth capturing for next time?"
                    />
                  </label>
                </div>
              )}

              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={saveOutcome}
                  disabled={savingOutcome}
                  className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: GOLD, color: NAVY }}
                >
                  {savingOutcome ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
