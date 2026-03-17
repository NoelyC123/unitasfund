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

  const chips = [
    { key: "all", label: `Total`, count: counts.all, bg: "#ffffff", text: NAVY, border: BORDER },
    { key: "interested", label: `Interested`, count: counts.interested, bg: "#fff7ed", text: "#92400e", border: "#fde68a" },
    { key: "applying", label: `Applying`, count: counts.applying, bg: "#e0f2fe", text: "#075985", border: "#bae6fd" },
    { key: "submitted", label: `Submitted`, count: counts.submitted, bg: "#e0e7ff", text: "#3730a3", border: "#c7d2fe" },
    { key: "won", label: `Won`, count: counts.won, bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
    { key: "lost", label: `Lost`, count: counts.lost, bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border p-3 shadow-sm" style={{ backgroundColor: "#ffffff", borderColor: BORDER }}>
        <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = statusFilter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setStatusFilter(c.key)}
              className="text-xs font-semibold px-3 py-2 rounded-full border transition-all hover:opacity-90"
              style={{
                backgroundColor: c.bg,
                color: c.text,
                borderColor: active ? GOLD : c.border,
                boxShadow: active ? "0 1px 0 rgba(0,0,0,0.04)" : "none",
              }}
            >
              <span>{c.label}</span>
              <span className="ml-2 tabular-nums" style={{ color: c.text, opacity: 0.85 }}>
                {c.count}
              </span>
            </button>
          );
        })}
        </div>
      </div>

      <div
        className="rounded-xl border overflow-hidden shadow-sm"
        style={{ backgroundColor: "#fff", borderColor: BORDER }}
      >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr style={{ backgroundColor: CREAM, borderBottom: `1px solid ${BORDER}` }}>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                Opportunity
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                Funder
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                Deadline
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <PipelineRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>
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
      <tr className="border-b last:border-b-0 hover:bg-gray-50" style={{ borderColor: BORDER }}>
        <td className="px-4 py-4">
          <a
            href={`/opportunity/${item.opportunity_id}`}
            className="font-semibold hover:underline"
            style={{ color: NAVY }}
          >
            {item.title}
          </a>
          {item.amount_text && (
            <p className="text-sm mt-0.5" style={{ color: MUTED }}>
              {item.amount_text}
            </p>
          )}
        </td>
        <td className="px-4 py-4 text-sm" style={{ color: MUTED }}>
          {item.funder_name ?? "—"}
        </td>
        <td className="px-4 py-4 text-sm tabular-nums" style={{ color: MUTED }}>
          {formatDeadline(item.deadline)}
        </td>
        <td className="px-4 py-4">
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
      </tr>

      {showOutcome && openOutcome && (
        <tr className="border-b last:border-b-0" style={{ borderColor: BORDER }}>
          <td colSpan={4} className="px-4 py-4" style={{ backgroundColor: CREAM }}>
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
