/**
 * 360Giving Bulk Ingest — ingest via the official 360Giving API (JSON).
 *
 * API: https://api.threesixtygiving.org/api/v1/grants/
 *
 * Run from UnitasFund root:
 *   npx tsx scripts/ingest/ingest-360giving.ts --limit=1000
 *
 * Options:
 *   --limit=N        Only upsert first N mapped grants (for testing)
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { getSupabaseService } from "../../lib/db/client";

const ORG_LIST_URL = "https://api.threesixtygiving.org/api/v1/org/";
const SOURCE = "360giving_bulk";
const API_LIMIT = 100;
const UPSERT_BATCH_SIZE = 500;
const API_DELAY_MS = 500;
const MIN_AWARD_DATE = "2020-01-01";
const HARD_CAP = 100_000;

// Pragmatic default: ingest from a small set of high-volume funders.
// Full corpus ingestion via the public API would otherwise require iterating ~400k orgs.
const DEFAULT_FUNDER_ORG_IDS = [
  "GB-GOR-DA1020", // Scottish Government (example in 360Giving docs; high volume)
  "GB-GOR-DA1035", // Scottish Enterprise (often present)
  "GB-GOV-UKRI", // if present
  "GB-CHC-1164883", // 360Giving
  "GB-CHC-218186", // Joseph Rowntree Foundation
  "GB-CHC-210183", // Esmee Fairbairn Foundation
  "GB-CHC-1105580", // Paul Hamlyn Foundation
  "GB-CHC-230260", // Garfield Weston Foundation
  "GB-CHC-258519", // Henry Smith Charity
  "GB-CHC-206360", // Wellcome Trust
  "GB-CHC-327114", // Lloyds Bank Foundation
  "GB-CHC-1190049", // National Lottery Heritage Fund
  "GB-CHC-1121600", // Power to Change
  "GB-CHC-1159982", // Wolfson Foundation
  "GB-CHC-1093844", // Comic Relief
  "GB-CHC-274206", // John Lyon's Charity
  "GB-CHC-1164021", // City Bridge Foundation
  "GB-CHC-205629", // Trust for London
  "GB-CHC-1091203", // Children in Need
  "GB-GOR-PB188", // National Lottery Community Fund
  "GB-CHC-1121739", // Sport England
  "GB-CHC-1036733", // Arts Council England
] as const;

const args = process.argv.slice(2);
function getArg(name: string): string | null {
  const match = args.find((a) => a.startsWith(`--${name}=`));
  return match ? match.split("=")[1] : null;
}
const limitArg = getArg("limit");
const funderArg = getArg("funder"); // comma-separated org ids
const ROW_LIMIT = limitArg ? parseInt(limitArg, 10) : 10_000;

interface GrantRow {
  funder_id: string;
  funder_name: string;
  recipient_name: string | null;
  recipient_region: string | null;
  amount_awarded: number | null;
  award_date: string | null;
  source: string;
  raw: Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDate(s: string | undefined | null): string | null {
  if (!s || !s.trim()) return null;
  const trimmed = s.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const ukMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (ukMatch) return `${ukMatch[3]}-${ukMatch[2]}-${ukMatch[1]}`;
  return null;
}

type ApiOrgListItem = {
  org_id?: string;
  name?: string;
};

type ApiOrgListResponse = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: ApiOrgListItem[];
};

type ApiGrantData = {
  id?: string;
  awardDate?: string | null;
  amountAwarded?: number | string | null;
  fundingOrganization?: Array<{ id?: string; name?: string | null }> | null;
  recipientOrganization?: Array<{ id?: string; name?: string | null }> | null;
};

type ApiGrantResult = {
  grant_id?: string;
  data?: ApiGrantData;
};

type ApiGrant = ApiGrantResult;

type ApiResponse = {
  count?: number;
  total?: number;
  results?: ApiGrantResult[];
  next?: string | null;
  previous?: string | null;
  cursor?: string | null;
};

function parseAmountAny(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  if (typeof v === "string") {
    const cleaned = v.replace(/[£,\s]/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) && num > 0 ? Math.round(num) : null;
  }
  return null;
}

function isOnOrAfter(date: string | null, minDate: string): boolean {
  if (!date) return false;
  // both YYYY-MM-DD
  return date >= minDate;
}

function mapApiGrantToRow(g: ApiGrant): GrantRow | null {
  const data = g.data ?? {};
  const id = (data.id ?? g.grant_id ?? "").trim();
  if (!id) return null;
  const award_date = parseDate(data.awardDate ?? null);
  if (!isOnOrAfter(award_date, MIN_AWARD_DATE)) return null;

  const amount_awarded = parseAmountAny(data.amountAwarded);
  if (amount_awarded != null && amount_awarded <= 0) return null;

  const funder_name =
    (data.fundingOrganization?.[0]?.name ?? "").trim() || "Unknown funder";
  const recipient_name =
    (data.recipientOrganization?.[0]?.name ?? "").trim() || null;

  return {
    funder_id: id,
    funder_name,
    recipient_name,
    recipient_region: null,
    amount_awarded,
    award_date,
    source: SOURCE,
    raw: g as unknown as Record<string, unknown>,
  };
}

async function fetchJsonWithRetries(url: string): Promise<ApiResponse> {
  const headers: Record<string, string> = {
    "User-Agent": "UnitasFund/360GivingIngest (contact: support@unitasconnect.org)",
    Accept: "application/json",
  };
  // Increase connect timeout for slow networks.
  const ac = new AbortController();
  let delay = 1000;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const timeout = setTimeout(() => ac.abort(), 30_000);
    let res: Response;
    try {
      res = await fetch(url, { headers, signal: ac.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (res.ok) return (await res.json()) as ApiResponse;
    const text = await res.text().catch(() => "");
    if (res.status === 429 || res.status >= 500) {
      console.warn(`API ${res.status} attempt ${attempt}/6. Retrying in ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
      delay = Math.min(30000, Math.round(delay * 1.8));
      continue;
    }
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }
  throw new Error("API retries exhausted");
}

async function ingestFromApi(): Promise<void> {
  const supabase = getSupabaseService();

  console.log(`\nFetching from 360Giving API (min award_date ${MIN_AWARD_DATE}, limit ${ROW_LIMIT})...`);

  let totalSeen = 0;
  let totalMapped = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let batch: GrantRow[] = [];

  async function flushBatch(): Promise<void> {
    if (batch.length === 0) return;

    const { data, error } = await supabase
      .from("grants_awarded")
      .upsert(batch, { onConflict: "funder_id" })
      .select("funder_id");

    if (error) {
      if (error.code === "23505" || error.code === "42P10") {
        console.warn(`Batch upsert error (${error.code}), trying individual inserts...`);
        for (const row of batch) {
          const { error: singleErr } = await supabase
            .from("grants_awarded")
            .upsert(row, { onConflict: "funder_id" });
          if (singleErr) {
            totalErrors++;
          } else {
            totalInserted++;
          }
        }
      } else {
        console.error(`Batch error: ${error.message} (${error.code})`);
        totalErrors += batch.length;
      }
    } else {
      totalInserted += data?.length ?? batch.length;
    }

    batch = [];
  }

  const safeFetch = async (url: string): Promise<{ ok: true; json: unknown } | { ok: false; status: number }> => {
    const headers: Record<string, string> = {
      "User-Agent": "UnitasFund/360GivingIngest (contact: support@unitasconnect.org)",
      Accept: "application/json",
    };
    const res = await fetch(url, { headers });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, json: await res.json() };
  };

  const funderOrgIds = funderArg
    ? funderArg.split(",").map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_FUNDER_ORG_IDS];

  console.log(`Using funders: ${funderOrgIds.join(", ")}`);
  console.log(`Grant page limit=${API_LIMIT}, upsert batch=${UPSERT_BATCH_SIZE}, API delay=${API_DELAY_MS}ms.`);

  for (const orgId of funderOrgIds) {
    if (totalMapped >= ROW_LIMIT || totalMapped >= HARD_CAP) break;
    let grantOffset = 0;
    let grantPage = 0;

    while (totalMapped < ROW_LIMIT && totalMapped < HARD_CAP) {
      grantPage++;
      const remaining = Math.min(ROW_LIMIT, HARD_CAP) - totalMapped;
      const limit = Math.min(API_LIMIT, remaining);
      const url = `${ORG_LIST_URL}${encodeURIComponent(orgId)}/grants_made/?limit=${limit}&offset=${grantOffset}`;
      const res = await safeFetch(url);
      if (!res.ok) {
        console.warn(`Funder ${orgId}: grants_made returned ${res.status}, stopping this funder.`);
        break;
      }
      const data = res.json as ApiResponse;
      const results = Array.isArray(data.results) ? data.results : [];
      if (results.length === 0) break;

      totalSeen += results.length;
      console.log(
        `  funder ${orgId}: grants page ${grantPage} (${results.length}) mapped=${totalMapped} inserted=${totalInserted}`
      );

      for (const g of results) {
        if (totalMapped >= ROW_LIMIT || totalMapped >= HARD_CAP) break;
        const mapped = mapApiGrantToRow(g as unknown as ApiGrant);
        if (!mapped) {
          totalSkipped++;
          continue;
        }
        totalMapped++;
        batch.push(mapped);
        if (batch.length >= UPSERT_BATCH_SIZE) {
          await flushBatch();
        }
      }
      await flushBatch();
      grantOffset += results.length;
      await sleep(API_DELAY_MS);
    }
  }

  console.log("\n=== 360Giving Bulk Ingest Complete ===");
  console.log(`  API results seen: ${totalSeen.toLocaleString()}`);
  console.log(`  Grants mapped:    ${totalMapped.toLocaleString()}`);
  console.log(`  Rows inserted:    ${totalInserted.toLocaleString()}`);
  console.log(`  Rows skipped:     ${totalSkipped.toLocaleString()}`);
  console.log(`  Errors:           ${totalErrors.toLocaleString()}`);
  console.log(`  Filter: award_date >= ${MIN_AWARD_DATE}`);
}

async function main() {
  console.log("360Giving Bulk Ingest for UnitasFund");
  console.log("====================================\n");

  await ingestFromApi();

  const supabase = getSupabaseService();
  const { count } = await supabase.from("grants_awarded").select("*", { count: "exact", head: true });
  console.log(`\nTotal rows in grants_awarded: ${count?.toLocaleString()}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

