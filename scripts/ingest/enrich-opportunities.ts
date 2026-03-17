/**
 * Enrich opportunities that have NULL descriptions using Claude to extract structured eligibility.
 * Run from UnitasFund root: npm run enrich -- --limit 20
 * Requires: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { getSupabaseService } from "../../lib/db/client";
import { scoreOpportunity } from "../../lib/scoring";
import type { OrgProfile, Opportunity } from "../../lib/scoring/types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 800;
const DELAY_MS = 500;

interface EnrichmentResult {
  description: string | null;
  eligibility_summary: string | null;
  location_filters: string[];
  sector_filters: string[];
  income_bands: string[];
}

function getLimitFromArgs(defaultLimit: number): number {
  const idx = process.argv.findIndex((a) => a === "--limit");
  if (idx === -1) return defaultLimit;
  const raw = process.argv[idx + 1];
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return defaultLimit;
  return Math.floor(n);
}

function buildPrompt(args: {
  title: string;
  url: string;
  pageText: string;
}): string {
  return `You are extracting fields from a grant opportunity web page.

CRITICAL DATA QUALITY RULES:
- Never invent, assume, estimate or guess. Only extract what is explicitly present in the provided page text.
- If a field cannot be extracted accurately from the page text, set it to null (or [] for arrays).
- Do NOT paraphrase funder names, amounts, or deadlines. If unsure, leave null.
- For "description": extract a short, plain-text description that appears on the page (prefer the first substantive paragraph or an on-page summary). Do not write your own summary.
- For "eligibility_summary": extract only eligibility criteria text that appears on the page. Do not infer.

Return ONLY valid JSON with exactly these keys:
{
  "description": string|null,
  "eligibility_summary": string|null,
  "location_filters": string[],
  "sector_filters": string[],
  "income_bands": string[]
}

Allowed values:
- location_filters: England, Scotland, Wales, Northern Ireland, Cumbria, Lancaster, North Lancashire, Lancashire, North West, UK-wide, UK
- sector_filters: Community, Arts & Culture, Environment, Health, Education, Housing, Employment, Sport, Heritage, Youth, SME, Research, Other
- income_bands: Under £10k, £10k-£50k, £50k-£100k, £100k-£500k, £500k+

Grant title: ${args.title}
Source URL: ${args.url}

PAGE TEXT (extract only from this):
${args.pageText}`;
}

function parseJsonFromResponse(text: string): EnrichmentResult | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as EnrichmentResult;
    if (
      !("description" in parsed) ||
      !("eligibility_summary" in parsed) ||
      !Array.isArray(parsed.location_filters) ||
      !Array.isArray(parsed.sector_filters) ||
      !Array.isArray(parsed.income_bands)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function trimOrNull(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length ? t : null;
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required.");
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const block = data.content?.find((b) => b.type === "text");
  return block?.text ?? "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripHtmlToText(html: string): string {
  let t = html;
  t = t.replace(/<script[\s\S]*?<\/script>/gi, " ");
  t = t.replace(/<style[\s\S]*?<\/style>/gi, " ");
  t = t.replace(/<\/(p|div|li|h1|h2|h3|h4|br)\s*>/gi, "\n");
  t = t.replace(/<[^>]+>/g, " ");
  t = t.replace(/&nbsp;/g, " ");
  t = t.replace(/&amp;/g, "&");
  t = t.replace(/&quot;/g, '"');
  t = t.replace(/&#39;/g, "'");
  t = t.replace(/\r/g, "");
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");
  t = t.replace(/[ \t]{2,}/g, " ");
  return t.trim();
}

async function fetchPageText(url: string): Promise<string | null> {
  if (!url || !url.trim()) return null;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const html = await res.text();
    const text = stripHtmlToText(html);
    if (!text) return null;
    // Keep prompt bounded.
    return text.slice(0, 12_000);
  } catch {
    return null;
  }
}

function dbOrgToProfile(row: Record<string, unknown>): OrgProfile & { id: string } {
  const id = String(row?.id ?? "");
  const name = String(row?.name ?? "").trim() || "Unknown";
  const org_type = (row?.org_type != null ? String(row.org_type) : "other") as OrgProfile["org_type"];
  const location_region =
    row?.location_region != null && String(row.location_region).trim() !== ""
      ? String(row.location_region).trim()
      : null;
  const annual_income_band =
    row?.annual_income_band != null && String(row.annual_income_band).trim() !== ""
      ? String(row.annual_income_band).trim()
      : null;
  let sectors: string[] = [];
  const raw = row?.sectors as unknown;
  if (Array.isArray(raw)) sectors = raw.map(String);
  else if (raw && typeof raw === "object") sectors = Object.values(raw as Record<string, unknown>).map(String);
  return { id, name, org_type, location_region, annual_income_band, sectors };
}

function dbOpportunityToScoring(row: Record<string, unknown>): Opportunity & { id: string } {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? "Untitled"),
    source_id: (row.source_id as string) ?? undefined,
    funder_name: (row.funder_name as string | null) ?? null,
    url: (row.url as string | null) ?? null,
    deadline: (row.deadline as string | null) ?? null,
    amount_text: (row.amount_text as string | null) ?? null,
    amount_min: row.amount_min != null ? Number(row.amount_min) : null,
    amount_max: row.amount_max != null ? Number(row.amount_max) : null,
    location_filters: (row.location_filters as unknown as Record<string, unknown>) ?? {},
    sector_filters: (row.sector_filters as unknown as Record<string, unknown>) ?? {},
    income_bands: (row.income_bands as unknown as Record<string, unknown>) ?? {},
    description: (row.description as string | null) ?? null,
    eligibility_summary: (row.eligibility_summary as string | null) ?? null,
  };
}

async function main() {
  const supabase = getSupabaseService();
  const limit = getLimitFromArgs(50);

  const { data: rows, error: fetchError } = await supabase
    .from("opportunities")
    .select(
      "id, title, url, source_id, funder_name, deadline, amount_text, amount_min, amount_max, description, eligibility_summary, location_filters, sector_filters, income_bands"
    )
    .is("description", null)
    .limit(limit);

  if (fetchError) {
    console.error("Failed to fetch opportunities:", fetchError.message);
    process.exit(1);
  }

  const list = rows ?? [];
  if (list.length === 0) {
    console.log("No opportunities with NULL description found.");
    return;
  }

  // Count "skipped" as opportunities not included because they already have description.
  const { count: alreadyCount } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .not("description", "is", null);

  console.log(`Found ${list.length} opportunities to enrich.`);

  let enriched = 0;
  let skipped = 0; // failed or cannot extract
  const enrichedIds: string[] = [];

  for (let i = 0; i < list.length; i++) {
    const opp = list[i];
    const title = opp.title ?? "Untitled";
    const url = (opp.url as string | null) ?? "";

    try {
      const pageText = (await fetchPageText(url)) ?? "";
      if (!pageText) {
        console.warn(`[${i + 1}/${list.length}] No page text fetched for: ${title}`);
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      const prompt = buildPrompt({ title, url, pageText });
      const responseText = await callClaude(prompt);
      const parsed = parseJsonFromResponse(responseText);

      if (!parsed) {
        console.warn(`[${i + 1}/${list.length}] Invalid JSON for: ${title}`);
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      const description = trimOrNull(parsed.description);
      const eligibility_summary = trimOrNull(parsed.eligibility_summary);
      const location_filters = Array.isArray(parsed.location_filters)
        ? parsed.location_filters.map(String).filter(Boolean)
        : [];
      const sector_filters = Array.isArray(parsed.sector_filters)
        ? parsed.sector_filters.map(String).filter(Boolean)
        : [];
      const income_bands = Array.isArray(parsed.income_bands)
        ? parsed.income_bands.map(String).filter(Boolean)
        : [];

      const { error: updateError } = await supabase
        .from("opportunities")
        .update({
          description,
          eligibility_summary,
          location_filters,
          sector_filters,
          income_bands,
        })
        .eq("id", opp.id);

      if (updateError) {
        console.warn(`[${i + 1}/${list.length}] Update failed for ${title}:`, updateError.message);
        skipped++;
      } else {
        enriched++;
        enrichedIds.push(String(opp.id));
        console.log(`Enriched ${enriched}/${list.length}: ${title}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[${i + 1}/${list.length}] Error for ${title}:`, message);
      skipped++;
    }

    if (i < list.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`Enriched ${enriched} opportunities, skipped ${alreadyCount ?? 0} (already have data)`);
  console.log(`Skipped/failed during enrichment: ${skipped}`);

  if (enrichedIds.length === 0) return;

  // Re-score only the enriched opportunities for all organisations.
  const { data: orgRows, error: orgError } = await supabase
    .from("organisations")
    .select("id, name, org_type, location_region, annual_income_band, sectors");
  if (orgError) {
    console.warn("Failed to fetch organisations for rescoring:", orgError.message);
    return;
  }

  const { data: updatedOppRows, error: oppError } = await supabase
    .from("opportunities")
    .select(
      "id, source_id, title, funder_name, url, deadline, amount_text, amount_min, amount_max, location_filters, sector_filters, income_bands, description, eligibility_summary, is_active"
    )
    .in("id", enrichedIds);
  if (oppError) {
    console.warn("Failed to fetch enriched opportunities for rescoring:", oppError.message);
    return;
  }

  const orgs = (orgRows ?? []).map((r) => dbOrgToProfile(r as unknown as Record<string, unknown>));
  const opps = (updatedOppRows ?? [])
    .map((r) => r as unknown as Record<string, unknown>)
    .filter((r) => (r.is_active as boolean) !== false);

  const computed_at = new Date().toISOString();
  const scoreRows: Array<Record<string, unknown>> = [];

  for (const org of orgs) {
    for (const oppRow of opps) {
      const opp = dbOpportunityToScoring(oppRow);
      const result = scoreOpportunity(org, opp);
      scoreRows.push({
        organisation_id: org.id,
        opportunity_id: opp.id,
        fit_score: result.fit.fit_score,
        fit_breakdown: result.fit.fit_breakdown,
        ev: result.ev.expected_value,
        win_probability: result.ev.win_probability,
        bid_cost_estimate: result.ev.bid_cost_estimate,
        computed_at,
      });
    }
  }

  const { error: scoresError } = await supabase.from("scores").upsert(scoreRows, {
    onConflict: "organisation_id,opportunity_id",
    ignoreDuplicates: false,
  });
  if (scoresError) {
    console.warn("Upsert scores error after enrichment:", scoresError.message);
    return;
  }
  console.log(`Re-scored ${opps.length} opportunities for ${orgs.length} organisations (${scoreRows.length} score rows).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
