import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const RECONCILE_ENDPOINT = "https://findthatcharity.uk/api/v1/reconcile/";
const BATCH_SIZE = 10;
const RATE_LIMIT_MS = 500;
const DEFAULT_MIN_SCORE = 80;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const TABLE = args.includes("--table")
  ? (args[args.indexOf("--table") + 1] as "grants_awarded" | "opportunities")
  : "grants_awarded";
const MIN_SCORE_ARG = args.includes("--min-score")
  ? parseInt(args[args.indexOf("--min-score") + 1], 10)
  : DEFAULT_MIN_SCORE;
const MIN_SCORE = isNaN(MIN_SCORE_ARG) ? DEFAULT_MIN_SCORE : MIN_SCORE_ARG;

interface ReconcileResult {
  id: string;
  name: string;
  score: number;
  match: boolean;
  type: { id: string; name: string }[];
}

interface ReconcileResponse {
  [key: string]: { result: ReconcileResult[] };
}

interface FunderMatch {
  raw_name: string;
  canonical_id: string | null;
  canonical_name: string | null;
  score: number | null;
  matched: boolean;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function reconcileBatch(names: string[]): Promise<Map<string, ReconcileResult | null>> {
  const queries: Record<string, { query: string; limit: number }> = {};
  names.forEach((name, i) => {
    queries[`q${i}`] = { query: name, limit: 3 };
  });

  const body = new URLSearchParams({ queries: JSON.stringify(queries) });
  const res = await fetch(RECONCILE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`FindThatCharity API error: ${res.status}`);

  const data = (await res.json()) as ReconcileResponse;
  const out = new Map<string, ReconcileResult | null>();

  names.forEach((name, i) => {
    const results = data[`q${i}`]?.result ?? [];
    const best =
      results.find((r) => r.score >= MIN_SCORE && r.match) ??
      results.find((r) => r.score >= MIN_SCORE) ??
      null;
    out.set(name, best);
  });

  return out;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  console.log(`\nFetching unique funder names from ${TABLE}...`);

  const { data: rows, error } = await supabase
    .from(TABLE)
    .select("funder_name")
    .not("funder_name", "is", null);

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  const allNames = [
    ...new Set(
      (rows ?? [])
        .map((r: Record<string, unknown>) => (r.funder_name as string | null)?.trim())
        .filter(Boolean) as string[]
    ),
  ];

  console.log(`Found ${allNames.length} unique funder names.`);
  if (allNames.length === 0) { console.log("Nothing to do."); return; }
  if (DRY_RUN) console.log("\nDRY RUN — no writes will be made.\n");

  const matches: FunderMatch[] = [];
  const batches = chunk(allNames, BATCH_SIZE);

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    console.log(`Batch ${b + 1}/${batches.length}: reconciling ${batch.length} names...`);

    try {
      const results = await reconcileBatch(batch);
      for (const name of batch) {
        const best = results.get(name) ?? null;
        const m: FunderMatch = best
          ? {
              raw_name: name,
              canonical_id: best.id,
              canonical_name: best.name.replace(/\s*\(.*?\)\s*$/, "").trim(),
              score: best.score,
              matched: true,
            }
          : { raw_name: name, canonical_id: null, canonical_name: null, score: null, matched: false };

        matches.push(m);
        console.log(
          m.matched
            ? `  MATCH [${m.score?.toFixed(0)}] ${name} → ${m.canonical_id}`
            : `  NO MATCH: ${name}`
        );
      }
    } catch (err) {
      console.error(`Batch ${b + 1} failed:`, (err as Error).message);
    }

    if (b < batches.length - 1) await sleep(RATE_LIMIT_MS);
  }

  const matched = matches.filter((m) => m.matched);
  const unmatched = matches.filter((m) => !m.matched);
  console.log(`\nMatched: ${matched.length}/${matches.length}`);
  if (unmatched.length > 0) {
    console.log("Unmatched:", unmatched.map((m) => m.raw_name).join(", "));
  }

  if (DRY_RUN) { console.log("\nDry run complete."); return; }

  console.log(`\nWriting to ${TABLE}...`);
  let written = 0;
  for (const m of matched) {
    const { error: updateErr } = await supabase
      .from(TABLE)
      .update({ canonical_funder_id: m.canonical_id, funder_name_canonical: m.canonical_name })
      .eq("funder_name", m.raw_name)
      .is("canonical_funder_id", null);

    if (updateErr) {
      console.error(`Failed to update "${m.raw_name}":`, updateErr.message);
    } else {
      written++;
    }
  }

  console.log(`\nDone. Written: ${written}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
