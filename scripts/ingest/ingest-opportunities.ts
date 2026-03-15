/**
 * Ingest opportunities from the UnitasConnect scraper CSV and compute scores.
 * Run from UnitasFund root: npm run ingest
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { createHash } from "crypto";
import { getSupabaseService } from "../../lib/db/client";
import { scoreOpportunity } from "../../lib/scoring";
import type { OrgProfile } from "../../lib/scoring/types";

const SCRAPER_OUTPUT_DIR = join(
  process.env.HOME ?? process.env.USERPROFILE ?? "",
  "Documents/UnitasConnect-Engine-Root/unitasconnect/scraper/output"
);

interface CsvRow {
  source_id: string;
  source_name: string;
  title: string;
  url: string;
  deadline: string;
  amount: string;
  description: string;
}

/** Known navigation / admin terms to exclude from ingest (case-insensitive match). */
const NAVIGATION_TERMS = new Set([
  "england",
  "scotland",
  "wales",
  "northern ireland",
  "getting ready to apply",
  "managing your funding",
  "funding programmes",
  "grants search",
  "apply now",
  "am i eligible",
  "our funds",
  "uk",
  "home",
  "funding",
  "grants",
  "search",
  "contact",
  "about",
  "login",
  "sign up",
  "360giving",
  "360 giving",
]);

const MIN_TITLE_LENGTH = 10;

/**
 * True if the title is navigation noise and should be excluded from ingest.
 */
function isNavigationNoise(title: string): boolean {
  const t = (title ?? "").trim();
  if (t.length < MIN_TITLE_LENGTH) return true;
  const lower = t.toLowerCase();
  return NAVIGATION_TERMS.has(lower);
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

function externalId(sourceId: string, url: string): string {
  const hash = createHash("sha256").update(`${sourceId}:${url}`).digest("hex");
  return hash.slice(0, 32);
}

function parseDeadline(text: string): string | null {
  if (!text || !text.trim()) return null;
  const s = text.trim();
  const months: Record<string, string> = {
    jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
    apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
    aug: "08", august: "08", sep: "09", sept: "09", september: "09", oct: "10", october: "10",
    nov: "11", november: "11", dec: "12", december: "12",
  };
  const match = s.match(/(\d{1,2})[\s/-]+(\w+)[\s/-]+(\d{4})/i);
  if (match) {
    const [, day, month, year] = match;
    const m = months[month.toLowerCase().slice(0, 3)];
    if (m) return `${year}-${m}-${day.padStart(2, "0")}`;
  }
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
    const a = Math.round(parseFloat(range[1].replace(/,/g, "")));
    const b = Math.round(parseFloat(range[2].replace(/,/g, "")));
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const single = s.match(/£?\s*([\d.]+)/);
  if (single) {
    const v = Math.round(parseFloat(single[1].replace(/,/g, "")));
    return { min: v, max: v };
  }
  return { min: null, max: null };
}

function csvRowToOpportunity(row: CsvRow) {
  const extId = externalId(row.source_id, row.url || row.title);
  const { min: amount_min, max: amount_max } = parseAmount(row.amount);
  const deadline = parseDeadline(row.deadline);
  const now = new Date().toISOString();
  return {
    source_id: row.source_id,
    external_id: extId,
    title: row.title?.trim() || "Untitled",
    description: row.description?.trim() || null,
    url: row.url?.trim() || null,
    funder_name: row.source_name?.trim() || null,
    amount_min,
    amount_max,
    amount_text: row.amount?.trim() || null,
    deadline,
    eligibility_summary: null,
    location_filters: {},
    sector_filters: {},
    income_bands: {},
    raw: { source_name: row.source_name },
    last_updated_at: now,
    is_active: true,
  };
}

/** Normalise DB org row to OrgProfile (handles JSONB sectors and missing fields). */
function dbOrgToProfile(row: Record<string, unknown>): OrgProfile & { id: string } {
  const id = String(row?.id ?? "");
  const name = String(row?.name ?? "").trim() || "Unknown";
  const org_type = (row?.org_type != null ? String(row.org_type) : "other") as OrgProfile["org_type"];
  const location_region = row?.location_region != null && String(row.location_region).trim() !== ""
    ? String(row.location_region).trim()
    : null;
  const annual_income_band = row?.annual_income_band != null && String(row.annual_income_band).trim() !== ""
    ? String(row.annual_income_band).trim()
    : null;
  let sectors: string[] = [];
  if (Array.isArray(row?.sectors)) {
    sectors = (row.sectors as unknown[]).map((s) => String(s).trim()).filter(Boolean);
  } else if (row?.sectors && typeof row.sectors === "object" && !Array.isArray(row.sectors)) {
    sectors = Object.values(row.sectors).map((s) => String(s).trim()).filter(Boolean);
  }
  return {
    id,
    name,
    org_type,
    location_region,
    annual_income_band,
    sectors,
  };
}

function dbOpportunityToScoring(row: {
  id: string;
  title: string;
  amount_min: number | null;
  amount_max: number | null;
  amount_text: string | null;
  deadline: string | null;
  location_filters: unknown;
  sector_filters: unknown;
  income_bands: unknown;
  description?: string | null;
  eligibility_summary?: string | null;
  funder_name?: string | null;
  source_id?: string | null;
}) {
  return {
    id: row.id,
    title: row.title,
    amount_min: row.amount_min != null ? Number(row.amount_min) : null,
    amount_max: row.amount_max != null ? Number(row.amount_max) : null,
    amount_text: row.amount_text ?? null,
    deadline: row.deadline ?? null,
    location_filters: row.location_filters ?? {},
    sector_filters: row.sector_filters ?? {},
    income_bands: row.income_bands ?? {},
    description: row.description ?? null,
    eligibility_summary: row.eligibility_summary ?? null,
    funder_name: row.funder_name ?? null,
    source_id: row.source_id ?? null,
  };
}

async function main() {
  const csvPath = findLatestCsv(SCRAPER_OUTPUT_DIR);
  if (!csvPath) {
    console.error("No opportunities CSV found in", SCRAPER_OUTPUT_DIR);
    process.exit(1);
  }
  console.log("Reading", csvPath);

  const csvText = readFileSync(csvPath, "utf-8");
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];
  const filtered = rows.filter((row) => !isNavigationNoise(row.title ?? ""));
  const skipped = rows.length - filtered.length;
  if (skipped > 0) {
    console.log("Filtered out", skipped, "navigation/noise titles.");
  }
  let opportunities = filtered.map(csvRowToOpportunity);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const beforePastDeadline = opportunities.length;
  opportunities = opportunities.filter((o) => {
    if (!o.deadline) return true;
    const d = new Date(o.deadline);
    if (Number.isNaN(d.getTime())) return true;
    d.setHours(0, 0, 0, 0);
    return d >= today;
  });
  const pastDeadlineCount = beforePastDeadline - opportunities.length;
  if (pastDeadlineCount > 0) {
    console.log("Excluded", pastDeadlineCount, "opportunities with deadline in the past.");
  }

  const supabase = getSupabaseService();

  const { data: upserted, error: upsertError } = await supabase
    .from("opportunities")
    .upsert(opportunities, {
      onConflict: "source_id,external_id",
      ignoreDuplicates: false,
    })
    .select("id");

  if (upsertError) {
    console.error("Upsert opportunities error:", upsertError.message);
    process.exit(1);
  }
  const ingestedCount = opportunities.length;
  console.log("Ingested", ingestedCount, "opportunities.");

  const currentKeys = new Set<string>();
  for (const o of opportunities) {
    currentKeys.add(`${o.source_id}:${o.external_id}`);
  }
  const sourceIds = Array.from(new Set(opportunities.map((o) => o.source_id)));
  if (sourceIds.length > 0) {
    const { data: existing, error: fetchExistingError } = await supabase
      .from("opportunities")
      .select("id, source_id, external_id")
      .in("source_id", sourceIds);
    if (!fetchExistingError && existing?.length) {
      const staleIds = existing
        .filter((r) => !currentKeys.has(`${r.source_id}:${r.external_id}`))
        .map((r) => r.id);
      if (staleIds.length > 0) {
        const { error: deactivateError } = await supabase
          .from("opportunities")
          .update({ is_active: false })
          .in("id", staleIds);
        if (deactivateError) {
          console.warn("Could not soft-deactivate stale opportunities:", deactivateError.message);
        } else {
          console.log("Soft-deactivated", staleIds.length, "stale opportunities.");
        }
      }
    }
  }

  const { data: orgs, error: orgsError } = await supabase
    .from("organisations")
    .select("id, name, org_type, location_region, annual_income_band, sectors");
  if (orgsError) {
    console.error("Fetch organisations error:", orgsError.message);
    process.exit(1);
  }
  if (!orgs?.length) {
    console.log("No organisations in database. Skipping scoring.");
    console.log("Summary:", ingestedCount, "opportunities ingested, 0 scores computed.");
    return;
  }

  const { data: allOpportunities, error: oppsError } = await supabase
    .from("opportunities")
    .select("id, title, amount_min, amount_max, amount_text, deadline, location_filters, sector_filters, income_bands, description, eligibility_summary, funder_name, source_id")
    .eq("is_active", true);
  if (oppsError) {
    console.error("Fetch opportunities error:", oppsError.message);
    process.exit(1);
  }
  const opps = allOpportunities ?? [];

  const scoreRows: {
    organisation_id: string;
    opportunity_id: string;
    fit_score: number;
    fit_breakdown: unknown;
    ev: number;
    win_probability: number;
    bid_cost_estimate: number;
    computed_at: string;
  }[] = [];
  const profiles = (orgs as Record<string, unknown>[]).map(dbOrgToProfile);

  if (profiles.length > 0) {
    console.log("First org profile (for scoring):", JSON.stringify(profiles[0], null, 2));
  }

  for (const org of profiles) {
    for (const opp of opps) {
      const opportunityForScoring = dbOpportunityToScoring(opp);
      const result = scoreOpportunity(org, opportunityForScoring);
      scoreRows.push({
        organisation_id: org.id,
        opportunity_id: opp.id,
        fit_score: result.fit.fit_score,
        fit_breakdown: result.fit.fit_breakdown,
        ev: result.ev.expected_value,
        win_probability: result.ev.win_probability,
        bid_cost_estimate: result.ev.bid_cost_estimate,
        computed_at: new Date().toISOString(),
      });
    }
  }

  const { error: scoresError } = await supabase
    .from("scores")
    .upsert(scoreRows, {
      onConflict: "organisation_id,opportunity_id",
      ignoreDuplicates: false,
    });
  if (scoresError) {
    console.error("Upsert scores error:", scoresError.message);
    process.exit(1);
  }
  const scoresCount = scoreRows.length;
  console.log("Computed", scoresCount, "scores.");
  console.log("Summary:", ingestedCount, "opportunities ingested,", scoresCount, "scores computed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
