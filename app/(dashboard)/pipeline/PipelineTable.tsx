"use client";

import { useMemo, useState } from "react";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";

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
    { key: "all", label: `Total: ${counts.all}`, bg: "#faf8f5", text: NAVY, border: "#ece6dd" },
    { key: "interested", label: `Interested: ${counts.interested}`, bg: "#fff7ed", text: "#92400e", border: "#fde68a" },
    { key: "applying", label: `Applying: ${counts.applying}`, bg: "#e0f2fe", text: "#075985", border: "#bae6fd" },
    { key: "submitted", label: `Submitted: ${counts.submitted}`, bg: "#e0e7ff", text: "#3730a3", border: "#c7d2fe" },
    { key: "won", label: `Won: ${counts.won}`, bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
    { key: "lost", label: `Lost: ${counts.lost}`, bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = statusFilter === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setStatusFilter(c.key)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border transition-opacity hover:opacity-90"
              style={{
                backgroundColor: c.bg,
                color: c.text,
                borderColor: active ? GOLD : c.border,
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: "#fff", borderColor: "#ece6dd" }}
      >
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr style={{ backgroundColor: "#faf8f5", borderBottom: "1px solid #ece6dd" }}>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
                Opportunity
              </th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
                Funder
              </th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
                Deadline
              </th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
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

  return (
    <tr className="border-b last:border-b-0" style={{ borderColor: "#ece6dd" }}>
      <td className="px-5 py-4">
        <a
          href={item.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ color: NAVY }}
        >
          {item.title}
        </a>
        {item.amount_text && (
          <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
            {item.amount_text}
          </p>
        )}
      </td>
      <td className="px-5 py-4 text-sm" style={{ color: "#4a5568" }}>
        {item.funder_name ?? "—"}
      </td>
      <td className="px-5 py-4 text-sm tabular-nums" style={{ color: "#4a5568" }}>
        {formatDeadline(item.deadline)}
      </td>
      <td className="px-5 py-4">
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={updating}
          className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-60"
          style={{
            borderColor: "#ece6dd",
            color: NAVY,
            backgroundColor: CREAM,
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
