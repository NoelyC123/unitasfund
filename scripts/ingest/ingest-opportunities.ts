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
import { assessEligibility } from "../../lib/scoring/eligibility-ai";

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
  "am i eligible",
  "our fundholders",
  "grant priorities",
  "creating a fund",
  "individual & families",
  "businesses",
  "grants committees",
  "acorn funds",
  "fundraising ideas",
  "our funds",
  "apply now",
  "search grants and funding",
  "measuring impact",
  "keeping warm",
  "double your donation",
  "winter warmth",
  "cultural fund",
  "apply for a grant",
  "skip to main content",
  "next set of pages",
  "previous set of pages",
  "sign in",
  "register",
  "cookie policy",
  "privacy policy",
  "terms and conditions",
  "accessibility statement",
  "back to top",
  "help finder",
  "data finder",
  "bid writers",
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
  "supply and delivery",
  "commissioning placements",
  "advisory services",
  "web application",
  "installation",
  "loaders",
  "placements",
]);

const MIN_TITLE_LENGTH = 10;

const TENDER_KEYWORDS = [
  "licence",
  "tender",
  "procurement",
  "framework agreement",
  "ferric sulphate",
  "crimint",
  "commissioning placement",
  "supply and installation",
  "vat advisory",
] as const;

function isTenderLikeTitle(title: string): boolean {
  const lower = (title ?? "").toLowerCase();
  return TENDER_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Contract reference heuristic:
 * exclude titles that contain a contract-like reference code (e.g. CM3072) and also
 * contain 3+ capitalised words (typical of procurement/contract headings).
 */
function looksLikeContractReference(title: string): boolean {
  const t = (title ?? "").trim();
  if (!t) return false;

  const hasCodeToken = /\b[A-Z]{2,}\d{2,}[A-Z0-9-]*\b/.test(t);
  if (!hasCodeToken) return false;

  const tokens = t
    .replace(/[()\-–—_,.]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const capitalisedWords = tokens.filter((w) => /^[A-Z][a-z]{2,}$/.test(w)).length;
  return capitalisedWords >= 3;
}

/**
 * True if the title is navigation noise and should be excluded from ingest.
 */
function isNavigationNoise(title: string): boolean {
  const t = (title ?? "").trim();
  if (t.length < MIN_TITLE_LENGTH) return true;
  const lower = t.toLowerCase();
  if (NAVIGATION_TERMS.has(lower)) return true;
  // Partial match: if any navigation term appears as a substring, treat as noise.
  for (const term of NAVIGATION_TERMS) {
    if (term && lower.includes(term)) {
      return true;
    }
  }
  return false;
}

const PROCUREMENT_TERMS = [
  "supply and delivery",
  "supply & delivery",
  "commissioning placements",
  "advisory services",
  "web application development",
  "installation services",
  "framework agreement",
  "invitation to tender",
  "itt ",
  "procurement",
  "contract notice",
  "pin notice",
];

function isProcurementTender(title: string): boolean {
  const lower = (title ?? "").toLowerCase();
  return PROCUREMENT_TERMS.some((term) => lower.includes(term));
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
    last_checked_at: now,
    // Default provenance for ingestion. We avoid overwriting enriched/360giving later.
    data_provenance: "scraped",
    confidence_score: 50,
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
    location_filters: (row.location_filters ?? {}) as Record<string, unknown>,
    sector_filters: (row.sector_filters ?? {}) as Record<string, unknown>,
    income_bands: (row.income_bands ?? {}) as Record<string, unknown>,
    description: row.description ?? null,
    eligibility_summary: row.eligibility_summary ?? null,
    funder_name: row.funder_name ?? null,
    // scoring types use undefined for optional fields (not null)
    source_id: row.source_id ?? undefined,
  };
}

async function main() {
  const skipAi = process.argv.includes("--skip-ai");
  const aiLimitIdx = process.argv.findIndex((a) => a === "--ai-limit");
  const aiLimitRaw = aiLimitIdx >= 0 ? process.argv[aiLimitIdx + 1] : null;
  const aiLimitParsed = aiLimitRaw ? Number(aiLimitRaw) : NaN;
  const aiLimit = Number.isFinite(aiLimitParsed) && aiLimitParsed > 0 ? Math.floor(aiLimitParsed) : 50;

  async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const runStartedAt = new Date().toISOString();
  const csvPath = findLatestCsv(SCRAPER_OUTPUT_DIR);
  if (!csvPath) {
    console.error("No opportunities CSV found in", SCRAPER_OUTPUT_DIR);
    process.exit(1);
  }
  console.log("Reading", csvPath);

  const csvText = readFileSync(csvPath, "utf-8");
  const rows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];
  const withoutFts = rows.filter((row) => (row.source_id ?? "").toLowerCase() !== "fts");
  const excludedFts = rows.length - withoutFts.length;
  if (excludedFts > 0) {
    console.log("Excluded", excludedFts, "rows where source_id is 'fts' (tenders).");
  }

  const rowsProcessed = rows.length;
  const filtered = withoutFts.filter((row) => {
    const title = row.title ?? "";
    const trimmed = title.trim();
    const lower = trimmed.toLowerCase();
    // Drop any scrape-error artefacts and any titles that look like bracketed UI/navigation labels.
    if (lower.includes("[scrape error]")) return false;
    if (trimmed.includes("[") && trimmed.includes("]")) return false;
    // Drop tender/procurement items (even if mislabelled by source_id).
    if (isTenderLikeTitle(trimmed)) return false;
    if (isProcurementTender(trimmed)) return false;
    // Drop contract-like reference codes (e.g. CM3072 ...) that look like procurement.
    if (looksLikeContractReference(trimmed)) return false;
    return !(isNavigationNoise(title) || isProcurementTender(title));
  });
  const skipped = rows.length - filtered.length;
  if (skipped > 0) {
    console.log("Filtered out", skipped, "navigation/noise titles.");
  }
  const sourceNameLower = (s: string | undefined) => (s ?? "").toLowerCase();
  const exclude360 = filtered.filter(
    (row) => !sourceNameLower(row.source_name).includes("360") && !sourceNameLower(row.source_name).includes("threesixtygiving")
  );
  const excluded360 = filtered.length - exclude360.length;
  if (excluded360 > 0) {
    console.log("Excluded", excluded360, "rows where source_name contains '360' or 'threesixtygiving'.");
  }
  let opportunities = exclude360.map(csvRowToOpportunity);

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

  // Deduplicate within this ingest batch to avoid Postgres
  // "ON CONFLICT DO UPDATE command cannot affect row a second time".
  const seen = new Set<string>();
  const beforeDeduped = opportunities.length;
  const deduped = opportunities.filter((o) => {
    const key = `${o.source_id}:${o.external_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const removed = beforeDeduped - deduped.length;
  if (removed > 0) {
    console.log("Deduplicated", removed, "duplicate opportunities in this batch.");
  }

  const supabase = getSupabaseService();
  let runSuccess = true;
  let runErrorMessage: string | null = null;

  let upserted: Array<{ id: string }> = [];
  try {
    const upsertRes = await supabase
      .from("opportunities")
      .upsert(deduped, {
        onConflict: "source_id,external_id",
        ignoreDuplicates: false,
      })
      .select("id, data_provenance");

    if (upsertRes.error) {
      console.error("Upsert opportunities error:", upsertRes.error.message);
      runSuccess = false;
      runErrorMessage = upsertRes.error.message;
      throw upsertRes.error;
    }
    upserted = (upsertRes.data ?? []) as Array<{ id: string }>;
  } catch (e) {
    // Best-effort run logging happens below.
    runSuccess = false;
    runErrorMessage = e instanceof Error ? e.message : String(e);
  }

  if (!runSuccess) {
    // Log ingestion run failure if possible.
    try {
      await supabase.from("ingestion_runs").insert({
        run_type: "ingest",
        rows_processed: rowsProcessed,
        rows_upserted: 0,
        rows_skipped: skipped,
        rows_failed: 1,
        started_at: runStartedAt,
        completed_at: new Date().toISOString(),
        error_message: runErrorMessage,
        success: false,
      });
    } catch {
      // ignore
    }
    process.exit(1);
  }

  const ingestedCount = deduped.length;
  console.log("Ingested", ingestedCount, "opportunities.");

  // Data quality: mark last_checked_at for all touched rows; set provenance to 'scraped'
  // but do NOT overwrite enriched/360giving.
  const touchedIds = upserted.map((r) => r.id).filter(Boolean);
  if (touchedIds.length > 0) {
    const now = new Date().toISOString();
    await supabase
      .from("opportunities")
      .update({ last_checked_at: now })
      .in("id", touchedIds);
    await supabase
      .from("opportunities")
      .update({ data_provenance: "scraped" })
      .in("id", touchedIds)
      .not("data_provenance", "in", '("enriched","360giving")');
  }

  const currentKeys = new Set<string>();
  for (const o of deduped) {
    currentKeys.add(`${o.source_id}:${o.external_id}`);
  }
  const sourceIds = Array.from(new Set(deduped.map((o) => o.source_id)));
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

  // Deactivate tenders/procurement items that should never be in UnitasFund.
  // We keep the rows for traceability but ensure they are not active.
  const { error: deactivateFtsError } = await supabase
    .from("opportunities")
    .update({ is_active: false })
    .eq("source_id", "fts");
  if (deactivateFtsError) {
    console.warn("Could not deactivate fts opportunities:", deactivateFtsError.message);
  }

  for (const kw of TENDER_KEYWORDS) {
    const { error: deactivateKwError } = await supabase
      .from("opportunities")
      .update({ is_active: false })
      .ilike("title", `%${kw}%`);
    if (deactivateKwError) {
      console.warn(`Could not deactivate tender keyword "${kw}":`, deactivateKwError.message);
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
  // For scoring, drop navigation / helper pages that slipped through ingest or older runs.
  const oppsForScoring = opps.filter((o) => {
    const title = o.title ?? "";
    const trimmed = title.trim();
    const lower = trimmed.toLowerCase();
    if (lower.includes("[scrape error]")) return false;
    if (trimmed.includes("[") && trimmed.includes("]")) return false;
    if (isNavigationNoise(title) || isProcurementTender(title)) return false;
    if (isTenderLikeTitle(trimmed)) return false;
    if (looksLikeContractReference(trimmed)) return false;
    return true;
  });

  const scoreRows: {
    organisation_id: string;
    opportunity_id: string;
    fit_score: number;
    fit_breakdown: unknown;
    ev: number;
    win_probability: number;
    bid_cost_estimate: number;
    eligibility_certainty?: string | null;
    eligibility_reasoning?: string | null;
    scoring_version: string;
    computed_at: string;
  }[] = [];
  const profiles = (orgs as Record<string, unknown>[]).map(dbOrgToProfile);

  if (profiles.length > 0) {
    console.log("First org profile (for scoring):", JSON.stringify(profiles[0], null, 2));
  }

  const oppById = new Map<string, ReturnType<typeof dbOpportunityToScoring>>();
  for (const opp of oppsForScoring) {
    oppById.set(String(opp.id), dbOpportunityToScoring(opp));
  }

  for (const org of profiles) {
    for (const opp of oppsForScoring) {
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
        eligibility_certainty: null,
        eligibility_reasoning: null,
        scoring_version: "v1",
        computed_at: new Date().toISOString(),
      });
    }
  }

  if (!skipAi) {
    console.log(`Running AI eligibility assessment (top ${aiLimit} per org)…`);
    const keyToRow = new Map<string, (typeof scoreRows)[number]>();
    for (const r of scoreRows) {
      keyToRow.set(`${r.organisation_id}:${r.opportunity_id}`, r);
    }

    for (const org of profiles) {
      const rowsForOrg = scoreRows
        .filter((r) => r.organisation_id === org.id)
        .sort((a, b) => b.fit_score - a.fit_score)
        .slice(0, aiLimit);

      for (let i = 0; i < rowsForOrg.length; i++) {
        const r = rowsForOrg[i];
        const opp = oppById.get(String(r.opportunity_id));
        if (!opp) continue;
        try {
          const res = await assessEligibility(org, opp);
          const target = keyToRow.get(`${r.organisation_id}:${r.opportunity_id}`);
          if (target) {
            target.eligibility_certainty = res.certainty;
            target.eligibility_reasoning = res.reasoning;
          }
          console.log(
            `AI [${org.name}] ${i + 1}/${rowsForOrg.length}: ${res.certainty} – ${opp.title}`
          );
        } catch {
          const target = keyToRow.get(`${r.organisation_id}:${r.opportunity_id}`);
          if (target) {
            target.eligibility_certainty = "check_eligibility";
            target.eligibility_reasoning = "Unable to assess automatically.";
          }
        }
        await sleep(200);
      }
    }
  } else {
    console.log("Skipping AI eligibility assessment (--skip-ai).");
  }

  // Upsert scores. If the DB schema hasn't been migrated yet to include the AI fields,
  // fall back to upserting without them (keeps ingest usable while migrations roll out).
  let scoresError: { message?: string } | null = null;
  {
    const res = await supabase.from("scores").upsert(scoreRows, {
      onConflict: "organisation_id,opportunity_id",
      ignoreDuplicates: false,
    });
    scoresError = res.error as { message?: string } | null;
  }
  if (scoresError) {
    const msg = String(scoresError.message ?? "");
    const missingAiCols =
      msg.includes("eligibility_certainty") || msg.includes("eligibility_reasoning");
    if (missingAiCols) {
      console.warn(
        "Scores table missing AI columns; retrying upsert without eligibility fields."
      );
      const stripped = scoreRows.map(({ eligibility_certainty, eligibility_reasoning, ...rest }) => rest);
      const res2 = await supabase.from("scores").upsert(stripped, {
        onConflict: "organisation_id,opportunity_id",
        ignoreDuplicates: false,
      });
      if (res2.error) {
        console.error("Upsert scores error:", res2.error.message);
        process.exit(1);
      }
    } else {
      console.error("Upsert scores error:", msg);
      process.exit(1);
    }
  }
  const scoresCount = scoreRows.length;
  console.log("Computed", scoresCount, "scores.");

  // Simple score distribution for diagnostics
  const buckets: Record<string, number> = {
    "0-19": 0,
    "20-39": 0,
    "40-59": 0,
    "60-79": 0,
    "80-100": 0,
  };
  for (const row of scoreRows) {
    const s = row.fit_score;
    if (s < 20) buckets["0-19"]++;
    else if (s < 40) buckets["20-39"]++;
    else if (s < 60) buckets["40-59"]++;
    else if (s < 80) buckets["60-79"]++;
    else buckets["80-100"]++;
  }

  console.log("Fit score distribution (all organisations x opportunities):");
  console.log("  0–19  :", buckets["0-19"]);
  console.log("  20–39 :", buckets["20-39"]);
  console.log("  40–59 :", buckets["40-59"]);
  console.log("  60–79 :", buckets["60-79"]);
  console.log("  80–100:", buckets["80-100"]);

  // Top 10 scores (by fit_score across all organisations/opportunities)
  const idToTitle = new Map<string, string>();
  for (const opp of oppsForScoring) {
    idToTitle.set(opp.id, opp.title);
  }
  const top = [...scoreRows]
    .sort((a, b) => b.fit_score - a.fit_score)
    .slice(0, 10);
  console.log("Top 10 scores:");
  top.forEach((row, idx) => {
    const title = idToTitle.get(row.opportunity_id) ?? "(unknown title)";
    console.log(
      `  ${idx + 1}. ${row.fit_score.toFixed(1)} – ${title} (org ${row.organisation_id})`
    );
  });

  console.log("Summary:", ingestedCount, "opportunities ingested,", scoresCount, "scores computed.");

  // Log ingestion run success
  try {
    await supabase.from("ingestion_runs").insert({
      run_type: "ingest",
      rows_processed: rowsProcessed,
      rows_upserted: touchedIds.length,
      rows_skipped: skipped,
      rows_failed: 0,
      started_at: runStartedAt,
      completed_at: new Date().toISOString(),
      error_message: null,
      success: true,
    });
  } catch {
    // ignore
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
