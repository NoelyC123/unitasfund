/**
 * Enrich opportunities with empty location_filters using Claude to extract eligibility.
 * Run from UnitasFund root: npx tsx scripts/ingest/enrich-opportunities.ts
 * Requires: ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { getSupabaseService } from "../../lib/db/client";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 300;
const DELAY_MS = 500;
const LIMIT = 50;

interface EnrichmentResult {
  location_filters: Record<string, boolean>;
  sector_filters: Record<string, boolean>;
  income_bands: string[];
}

function buildPrompt(title: string, description: string): string {
  return `Extract eligibility data from this grant opportunity. Return ONLY valid JSON with these fields:
- location_filters: object where keys are UK regions this grant covers (England, Scotland, Wales, Northern Ireland, Cumbria, Lancaster, North Lancashire, North West, UK-wide). Set value to true for each that applies.
- sector_filters: object where keys are sectors (Community, Arts & Culture, Environment, Health, Education, Housing, Employment, SME, Research). Set value to true for each that applies.
- income_bands: array of strings from: [Under £10k, £10k-£50k, £50k-£100k, £100k-£500k, £500k+]. Include all that are eligible, or empty array if unrestricted.

Grant title: ${title}
Description: ${description}`;
}

function parseJsonFromResponse(text: string): EnrichmentResult | null {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as EnrichmentResult;
    if (
      typeof parsed.location_filters !== "object" ||
      typeof parsed.sector_filters !== "object" ||
      !Array.isArray(parsed.income_bands)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Convert Claude's object format to arrays for scoring engine (keys for filters, array for income_bands). */
function toDbFormat(result: EnrichmentResult): {
  location_filters: string[];
  sector_filters: string[];
  income_bands: string[];
} {
  return {
    location_filters: Object.keys(result.location_filters || {}).filter(
      (k) => (result.location_filters as Record<string, boolean>)[k] === true
    ),
    sector_filters: Object.keys(result.sector_filters || {}).filter(
      (k) => (result.sector_filters as Record<string, boolean>)[k] === true
    ),
    income_bands: Array.isArray(result.income_bands) ? result.income_bands : [],
  };
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

async function main() {
  const supabase = getSupabaseService();

  const { data: rows, error: fetchError } = await supabase
    .from("opportunities")
    .select("id, title, description, location_filters");

  if (fetchError) {
    console.error("Failed to fetch opportunities:", fetchError.message);
    process.exit(1);
  }

  const list = (rows ?? []).filter(
    (r) => !r.location_filters || Object.keys(r.location_filters as Record<string, unknown>).length === 0
  ).slice(0, LIMIT);
  if (list.length === 0) {
    console.log("No opportunities with empty location_filters found.");
    return;
  }

  console.log(`Found ${list.length} opportunities to enrich.`);

  let enriched = 0;
  let skipped = 0;

  for (let i = 0; i < list.length; i++) {
    const opp = list[i];
    const title = opp.title ?? "Untitled";
    const description = opp.description ?? "";

    try {
      const prompt = buildPrompt(title, description);
      const responseText = await callClaude(prompt);
      const parsed = parseJsonFromResponse(responseText);

      if (!parsed) {
        console.warn(`[${i + 1}/${list.length}] Invalid JSON for: ${title}`);
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      const { location_filters, sector_filters, income_bands } = toDbFormat(parsed);

      const { error: updateError } = await supabase
        .from("opportunities")
        .update({
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

  console.log("\nSummary:");
  console.log(`  Enriched: ${enriched}`);
  console.log(`  Skipped/failed: ${skipped}`);
  console.log(`  Total processed: ${list.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
