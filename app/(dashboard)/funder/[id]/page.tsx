import { createClient } from "@/lib/db/server";
import { redirect } from "next/navigation";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";
const CREAM = "#f7f4ef";
const BORDER = "#ece6dd";
const MUTED = "#6b7f95";

function formatMoney(n: number): string {
  const v = Math.round(n);
  return `£${v.toLocaleString("en-GB")}`;
}

function formatDate(d: string): string {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const metadata = {
  title: "Funder | UnitasFund",
};

export default async function FunderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const funderName = decodeURIComponent(id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = funderName.trim();
  const withoutLeadingThe = trimmed.replace(/^The\s+/i, "");
  const withLeadingThe = withoutLeadingThe === trimmed ? `The ${trimmed}` : `The ${withoutLeadingThe}`;

  // Search terms to handle small naming variations across sources.
  const searchTerms = Array.from(
    new Set([trimmed, withoutLeadingThe, withLeadingThe].map((s) => s.trim()).filter(Boolean))
  );

  const orQuery = searchTerms.map((t) => `funder_name.ilike.%${t}%`).join(",");

  const { data, error } = await supabase
    .from("grants_awarded")
    .select("funder_name, recipient_name, amount_awarded, award_date")
    .or(orQuery)
    .order("award_date", { ascending: true });

  if (error) {
    return (
      <div className="rounded-xl border p-8" style={{ backgroundColor: "#fff", borderColor: BORDER }}>
        <a href="/dashboard" className="text-sm font-semibold hover:underline" style={{ color: GOLD }}>
          ← Dashboard
        </a>
        <h1 style={{ fontFamily: "var(--font-heading, Georgia, serif)", fontSize: "28px", fontWeight: 700, color: NAVY }}>
          {funderName}
        </h1>
        <p className="text-sm mt-2" style={{ color: "#b91c1c" }}>
          Error loading funder profile: {error.message}
        </p>
      </div>
    );
  }

  const rows = (data ?? []).map((r: any) => ({
    funder_name: String(r.funder_name ?? funderName),
    recipient_name: r.recipient_name ? String(r.recipient_name) : null,
    amount_awarded: r.amount_awarded != null ? Number(r.amount_awarded) : null,
    award_date: r.award_date ? String(r.award_date) : null,
  }));

  const amounts = rows.map((r) => r.amount_awarded).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const totalCount = rows.length;
  const totalAmount = amounts.reduce((a, b) => a + b, 0);
  const avgAmount = amounts.length ? totalAmount / amounts.length : 0;

  const dates = rows.map((r) => r.award_date).filter((d): d is string => Boolean(d));
  const earliest = dates[0] ?? null;
  const latest = dates.length ? dates[dates.length - 1] : null;

  const byRecipient = new Map<string, number>();
  for (const r of rows) {
    if (!r.recipient_name) continue;
    const amt = r.amount_awarded ?? 0;
    byRecipient.set(r.recipient_name, (byRecipient.get(r.recipient_name) ?? 0) + amt);
  }
  const topRecipients = [...byRecipient.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, amt]) => ({ name, amt }));

  const byYear = new Map<number, { count: number; total: number }>();
  for (const r of rows) {
    if (!r.award_date) continue;
    const year = new Date(r.award_date).getFullYear();
    if (!Number.isFinite(year)) continue;
    const prev = byYear.get(year) ?? { count: 0, total: 0 };
    byYear.set(year, { count: prev.count + 1, total: prev.total + (r.amount_awarded ?? 0) });
  }
  const yearRows = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, v]) => ({ year, ...v }));

  // Debug: if we matched nothing, log example funder_name values present in the DB.
  if (totalCount === 0) {
    try {
      const { data: distinctRows } = await supabase
        .from("grants_awarded")
        .select("funder_name")
        .order("funder_name", { ascending: true })
        .limit(50);
      const names = Array.from(new Set((distinctRows ?? []).map((r: any) => String(r.funder_name ?? "").trim()).filter(Boolean)));
      console.log(
        `[FunderPage] No grants matched for "${funderName}". Example funder_name values (up to 50 distinct):`,
        names.slice(0, 50)
      );
    } catch (e) {
      console.log("[FunderPage] Debug query for distinct funder_name failed:", e);
    }
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl border p-8"
        style={{ backgroundColor: "#fff", borderColor: BORDER }}
      >
        <a href="/dashboard" className="text-sm font-semibold hover:underline" style={{ color: GOLD }}>
          ← Dashboard
        </a>
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: GOLD }}>
          Funder profile
        </p>
        <h1
          style={{
            fontFamily: "var(--font-heading, Georgia, serif)",
            fontSize: "32px",
            fontWeight: 700,
            color: NAVY,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {funderName}
        </h1>
        <p className="text-sm mt-2" style={{ color: MUTED }}>
          {totalCount === 0
            ? "We don't have historical award data for this funder yet. Data is updated weekly from 360Giving and other sources."
            : `Award data across ${totalCount.toLocaleString("en-GB")} grants.`}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6">
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: CREAM, border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: "#6b7280" }}>Total grants</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: NAVY }}>{totalCount.toLocaleString("en-GB")}</p>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: CREAM, border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: "#6b7280" }}>Total awarded</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: GOLD }}>{formatMoney(totalAmount)}</p>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: CREAM, border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: "#6b7280" }}>Average grant</p>
            <p className="text-xl font-bold tabular-nums" style={{ color: NAVY }}>{amounts.length ? formatMoney(avgAmount) : "—"}</p>
          </div>
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: CREAM, border: `1px solid ${BORDER}` }}>
            <p className="text-xs" style={{ color: "#6b7280" }}>Date range</p>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>
              {earliest && latest ? `${formatDate(earliest)} → ${formatDate(latest)}` : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border p-6" style={{ backgroundColor: "#fff", borderColor: BORDER }}>
          <h2 style={{ fontFamily: "var(--font-heading, Georgia, serif)", fontSize: "18px", fontWeight: 600, color: NAVY }}>
            Top recipients
          </h2>
          <p className="text-sm mt-1" style={{ color: MUTED }}>
            Top 10 recipients by total amount awarded.
          </p>
          <div className="mt-4 space-y-2">
            {topRecipients.length === 0 ? (
              <p className="text-sm" style={{ color: MUTED }}>No recipient award amounts available.</p>
            ) : (
              topRecipients.map((r) => (
                <div key={r.name} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2" style={{ backgroundColor: "#faf8f5", border: `1px solid ${BORDER}` }}>
                  <span className="text-sm font-medium" style={{ color: NAVY }}>{r.name}</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: GOLD }}>{formatMoney(r.amt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border p-6" style={{ backgroundColor: "#fff", borderColor: BORDER }}>
          <h2 style={{ fontFamily: "var(--font-heading, Georgia, serif)", fontSize: "18px", fontWeight: 600, color: NAVY }}>
            Awards by year
          </h2>
          <p className="text-sm mt-1" style={{ color: MUTED }}>
            Count and total awarded per year.
          </p>
          <div className="mt-4 space-y-2">
            {yearRows.length === 0 ? (
              <p className="text-sm" style={{ color: MUTED }}>No award dates available.</p>
            ) : (
              yearRows.map((y) => (
                <div key={y.year} className="flex items-center justify-between gap-4 rounded-lg px-3 py-2" style={{ backgroundColor: "#faf8f5", border: `1px solid ${BORDER}` }}>
                  <span className="text-sm font-medium" style={{ color: NAVY }}>{y.year}</span>
                  <span className="text-sm tabular-nums" style={{ color: MUTED }}>{y.count.toLocaleString("en-GB")} grants</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: GOLD }}>{formatMoney(y.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

