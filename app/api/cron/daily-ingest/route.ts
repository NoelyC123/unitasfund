import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { createHash } from "crypto";

import { getSupabaseService } from "@/lib/db/client";
import { scoreOpportunity } from "@/lib/scoring";
import type { OrgProfile } from "@/lib/scoring/types";
import { assessEligibility } from "@/lib/scoring/eligibility-ai";

export const runtime = "nodejs";

const SCRAPER_OUTPUT_DIR = join(
  process.env.HOME ?? process.env.USERPROFILE ?? "",
  "Documents/UnitasConnect-Engine-Root/unitasconnect/scraper/output"
);

type CsvRow = {
  source_id: string;
  source_name: string;
  title: string;
  url: string;
  deadline: string;
  amount: string;
  description: string;
};

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const h = req.headers.get("authorization") ?? "";
  const token = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : h.trim();
  return token === secret;
}

function findLatestCsv(dir: string): string | null {
  try {
    const withStats = readdirSync(dir)
      .filter((f) => f.endsWith(".csv") && f.includes("opportunities"))
      .map((f) => ({ name: f, mtime: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    return withStats.length > 0 ? join(dir, withStats[0].name) : null;
  } catch {
    return null;
  }
}

function externalId(sourceId: string, urlOrTitle: string): string {
  const hash = createHash("sha256").update(`${sourceId}:${urlOrTitle}`).digest("hex");
  return hash.slice(0, 32);
}

function parseDeadline(text: string): string | null {
  if (!text || !text.trim()) return null;
  const s = text.trim();
  const iso = s.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  return null;
}

function parseAmount(amount: string): { min: number | null; max: number | null } {
  if (!amount || !amount.trim()) return { min: null, max: null };
  const s = amount.trim().replace(/,/g, "");
  const million = s.match(/£?\s*([\d.]+)\s*m(?:illion)?/i);
  if (million) {
    const v = Math.round(parseFloat(million[1]) * 1_000_000);
    return { min: v, max: v };
  }
  const range = s.match(/£?\s*([\d.]+)\s*[-–—]\s*£?\s*([\d.]+)/i);
  if (range) {
    const a = Math.round(parseFloat(range[1]));
    const b = Math.round(parseFloat(range[2]));
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const single = s.match(/£?\s*([\d.]+)/);
  if (single) {
    const v = Math.round(parseFloat(single[1]));
    return { min: v, max: v };
  }
  return { min: null, max: null };
}

function dbOrgToProfile(row: Record<string, unknown>): OrgProfile & { id: string } {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    org_type: (row.org_type ?? "other") as OrgProfile["org_type"],
    location_region: (row.location_region as string | null) ?? null,
    annual_income_band: (row.annual_income_band as string | null) ?? null,
    sectors: Array.isArray(row.sectors)
      ? (row.sectors as unknown[]).map(String)
      : typeof row.sectors === "object" && row.sectors
      ? Object.values(row.sectors as Record<string, unknown>).map(String)
      : [],
  };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const supabase = getSupabaseService();

  const csvPath = findLatestCsv(SCRAPER_OUTPUT_DIR);
  if (!csvPath) {
    console.log("[cron.daily-ingest] No CSV found in", SCRAPER_OUTPUT_DIR);
    return NextResponse.json({ ok: true, skipped: true, reason: "no_csv", startedAt });
  }

  console.log("[cron.daily-ingest] Reading", csvPath);
  const csvText = readFileSync(csvPath, "utf-8");
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];

  const nowIso = new Date().toISOString();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const opportunitiesRaw = rows
    .filter((r) => (r.source_id ?? "").toLowerCase() !== "fts")
    .map((row) => {
      const ext = externalId(row.source_id, row.url || row.title);
      const amt = parseAmount(row.amount);
      const deadline = parseDeadline(row.deadline);
      return {
        source_id: row.source_id,
        external_id: ext,
        title: (row.title ?? "Untitled").trim() || "Untitled",
        description: (row.description ?? "").trim() || null,
        url: (row.url ?? "").trim() || null,
        funder_name: (row.source_name ?? "").trim() || null,
        amount_min: amt.min,
        amount_max: amt.max,
        amount_text: (row.amount ?? "").trim() || null,
        deadline,
        eligibility_summary: null,
        location_filters: {},
        sector_filters: {},
        income_bands: {},
        raw: { source_name: row.source_name },
        last_updated_at: nowIso,
        last_checked_at: nowIso,
        data_provenance: "scraped",
        confidence_score: 50,
        is_active: true,
      };
    })
    .filter((o) => {
      if (!o.deadline) return true;
      const d = new Date(o.deadline);
      if (Number.isNaN(d.getTime())) return true;
      d.setHours(0, 0, 0, 0);
      return d >= today;
    });

  const seen = new Set<string>();
  const opportunities = opportunitiesRaw.filter((o) => {
    const k = `${o.source_id}:${o.external_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Determine "new" keys by checking which keys already exist.
  const keysBySource = new Map<string, string[]>();
  for (const o of opportunities) {
    const arr = keysBySource.get(o.source_id) ?? [];
    arr.push(o.external_id);
    keysBySource.set(o.source_id, arr);
  }

  const existingKeys = new Set<string>();
  for (const [sourceId, extIds] of keysBySource.entries()) {
    for (let i = 0; i < extIds.length; i += 500) {
      const chunk = extIds.slice(i, i + 500);
      const { data } = await supabase
        .from("opportunities")
        .select("source_id, external_id")
        .eq("source_id", sourceId)
        .in("external_id", chunk);
      for (const r of data ?? []) {
        existingKeys.add(`${(r as any).source_id}:${(r as any).external_id}`);
      }
    }
  }

  const newKeys = new Set<string>();
  for (const o of opportunities) {
    const k = `${o.source_id}:${o.external_id}`;
    if (!existingKeys.has(k)) newKeys.add(k);
  }

  const upsertRes = await supabase
    .from("opportunities")
    .upsert(opportunities, { onConflict: "source_id,external_id", ignoreDuplicates: false })
    .select("id, source_id, external_id");
  if (upsertRes.error) {
    console.error("[cron.daily-ingest] Upsert error:", upsertRes.error.message);
    return NextResponse.json({ ok: false, error: upsertRes.error.message }, { status: 500 });
  }

  const touched = (upsertRes.data ?? []) as Array<{ id: string; source_id: string; external_id: string }>;
  const newOpportunityIds = touched
    .filter((r) => newKeys.has(`${r.source_id}:${r.external_id}`))
    .map((r) => r.id);

  // Compute scores for all orgs across all active opportunities.
  const [{ data: orgs, error: orgErr }, { data: opps, error: oppErr }] = await Promise.all([
    supabase.from("organisations").select("id, name, org_type, location_region, annual_income_band, sectors"),
    supabase
      .from("opportunities")
      .select(
        "id, title, amount_min, amount_max, amount_text, deadline, location_filters, sector_filters, income_bands, description, eligibility_summary, funder_name, source_id"
      )
      .eq("is_active", true),
  ]);
  if (orgErr) return NextResponse.json({ ok: false, error: orgErr.message }, { status: 500 });
  if (oppErr) return NextResponse.json({ ok: false, error: oppErr.message }, { status: 500 });

  const computed_at = new Date().toISOString();
  const scoring_version = "cron_v1";
  const profiles = (orgs ?? []).map((r) => dbOrgToProfile(r as any));

  const scoreRows: any[] = [];
  for (const p of profiles) {
    for (const o of opps ?? []) {
      const opp = o as any;
      const result = scoreOpportunity(p, {
        id: String(opp.id),
        title: String(opp.title ?? "Untitled"),
        amount_min: opp.amount_min != null ? Number(opp.amount_min) : null,
        amount_max: opp.amount_max != null ? Number(opp.amount_max) : null,
        amount_text: (opp.amount_text as string | null) ?? null,
        deadline: (opp.deadline as string | null) ?? null,
        location_filters: (opp.location_filters as Record<string, unknown>) ?? {},
        sector_filters: (opp.sector_filters as Record<string, unknown>) ?? {},
        income_bands: (opp.income_bands as Record<string, unknown>) ?? {},
        description: (opp.description as string | null) ?? null,
        eligibility_summary: (opp.eligibility_summary as string | null) ?? null,
        funder_name: (opp.funder_name as string | null) ?? null,
        source_id: (opp.source_id as string | null) ?? undefined,
      });
      scoreRows.push({
        organisation_id: p.id,
        opportunity_id: String(opp.id),
        fit_score: result.fit.fit_score,
        fit_breakdown: result.fit.fit_breakdown,
        ev: result.ev.expected_value,
        win_probability: result.ev.win_probability,
        bid_cost_estimate: result.ev.bid_cost_estimate,
        scoring_version,
        computed_at,
      });
    }
  }

  const scoresUpsert = await supabase.from("scores").upsert(scoreRows, {
    onConflict: "organisation_id,opportunity_id",
    ignoreDuplicates: false,
  });
  if (scoresUpsert.error) {
    console.error("[cron.daily-ingest] Scores upsert error:", scoresUpsert.error.message);
    return NextResponse.json({ ok: false, error: scoresUpsert.error.message }, { status: 500 });
  }

  // Run AI eligibility on top 20 NEW opportunities per org.
  let aiAssessed = 0;
  const aiLimit = 20;
  if (newOpportunityIds.length > 0) {
    for (const p of profiles) {
      const { data: topScores } = await supabase
        .from("scores")
        .select(
          "opportunity_id, fit_score, opportunities!inner (id, title, description, eligibility_summary, funder_name, amount_text, location_filters, sector_filters)"
        )
        .eq("organisation_id", p.id)
        .in("opportunity_id", newOpportunityIds)
        .order("fit_score", { ascending: false })
        .limit(aiLimit);

      for (const row of topScores ?? []) {
        const opp = (row as any).opportunities ?? {};
        const assessment = await assessEligibility(p, {
          id: String(opp.id),
          title: String(opp.title ?? "Untitled"),
          description: (opp.description as string | null) ?? null,
          eligibility_summary: (opp.eligibility_summary as string | null) ?? null,
          funder_name: (opp.funder_name as string | null) ?? null,
          amount_text: (opp.amount_text as string | null) ?? null,
          amount_min: null,
          amount_max: null,
          deadline: null,
          location_filters: (opp.location_filters as Record<string, unknown>) ?? {},
          sector_filters: (opp.sector_filters as Record<string, unknown>) ?? {},
          income_bands: {},
          url: null,
          source_id: undefined,
        });

        await supabase
          .from("scores")
          .update({
            eligibility_certainty: assessment.certainty,
            eligibility_reasoning: assessment.reasoning,
          })
          .eq("organisation_id", p.id)
          .eq("opportunity_id", String((row as any).opportunity_id));

        aiAssessed += 1;
        await sleep(200);
      }
    }
  }

  const completedAt = new Date().toISOString();
  console.log("[cron.daily-ingest] complete", {
    csvRows: rows.length,
    upserted: opportunities.length,
    newOpportunities: newOpportunityIds.length,
    orgs: profiles.length,
    scoresUpserted: scoreRows.length,
    aiAssessed,
    startedAt,
    completedAt,
  });

  return NextResponse.json({
    ok: true,
    startedAt,
    completedAt,
    csvRows: rows.length,
    upserted: opportunities.length,
    newOpportunities: newOpportunityIds.length,
    orgs: profiles.length,
    scoresUpserted: scoreRows.length,
    aiAssessed,
  });
}

