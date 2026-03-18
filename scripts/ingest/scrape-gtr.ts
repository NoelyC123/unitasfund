/**
 * Ingest award intelligence from UKRI Gateway to Research (GtR) API.
 * Run from UnitasFund root: npm run ingest:gtr
 * Requires: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { getSupabaseService } from "../../lib/db/client";

const BASE_URL = "https://gtr.ukri.org/api";
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 500;
const SOURCE = "ukri_gtr";
const MAX_PAGES = 500;

type GtrProjectSearchResult = {
  projectComposition?: { project?: GtrProject };
};

type GtrSearchResponse = {
  facetedSearchResultBean?: {
    results?: GtrProjectSearchResult[];
    totalPages?: number;
    totalResults?: number;
    page?: number;
    fetchSize?: number;
  };
};

type GtrProject = {
  id?: string;
  title?: string;
  researchTopics?: Array<{ text?: string } | { name?: string } | string> | null;
  fund?: {
    valuePounds?: number | null;
    start?: string | null;
    funder?: { name?: string | null } | null;
  } | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAwardDateToDateOnlyIso(s: string | null | undefined): string | null {
  if (!s || !String(s).trim()) return null;
  const d = new Date(String(s).trim());
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // DATE column
}

function firstTopicText(p: GtrProject): string | null {
  const topics = p.researchTopics ?? [];
  if (!Array.isArray(topics) || topics.length === 0) return null;
  const t0 = topics[0];
  if (typeof t0 === "string") return t0.trim() || null;
  if (!t0 || typeof t0 !== "object") return null;
  const maybeText = (t0 as { text?: unknown }).text;
  if (typeof maybeText === "string" && maybeText.trim()) return maybeText.trim();
  const maybeName = (t0 as { name?: unknown }).name;
  if (typeof maybeName === "string" && maybeName.trim()) return maybeName.trim();
  return null;
}

function mapProjectToGrantAwarded(p: GtrProject) {
  const gtrId = String(p.id ?? "").trim();
  if (!gtrId) return null;

  const value = typeof p.fund?.valuePounds === "number" ? p.fund.valuePounds : null;
  const award_amount = value != null && Number.isFinite(value) ? Math.round(value) : null;
  if (award_amount == null || award_amount === 0) return null;

  const title = String(p.title ?? "").trim() || "Untitled";
  const funder_name =
    (p.fund?.funder?.name != null ? String(p.fund.funder.name).trim() : "") || "UKRI";
  const award_date = parseAwardDateToDateOnlyIso(p.fund?.start ?? null);
  const sector = firstTopicText(p);
  const region = "UK-wide";

  return {
    funder_id: gtrId,
    funder_name,
    recipient_name: null,
    recipient_region: region,
    amount_awarded: award_amount,
    award_date,
    source: SOURCE,
    raw: {
      external_id: gtrId,
      title,
      sector,
      region,
      gtr_project_id: gtrId,
    },
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GtR ${res.status} for ${path}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

async function fetchAllProjectsViaSearch(args: { term: string; label: string }) {
  const all: GtrProject[] = [];
  const seenIds = new Set<string>();
  let pagesFetched = 0;
  let totalPages: number | null = null;
  let totalResults: number | null = null;

  const fetchWithRetries = async (page: number) => {
    let attempt = 0;
    let delayMs = 2000;
    while (attempt < 5) {
      try {
        const q = new URLSearchParams();
        q.set("term", args.term);
        q.set("page", String(page));
        q.set("fetchSize", String(PAGE_SIZE));
        const data = await fetchJson<GtrSearchResponse>(`/search/project?${q.toString()}`);
        return data;
      } catch (e) {
        attempt++;
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`${args.label}: page ${page} fetch failed (attempt ${attempt}/5): ${msg.slice(0, 180)}`);
        if (attempt >= 5) break;
        await sleep(delayMs);
        delayMs = Math.min(30000, Math.round(delayMs * 1.8));
      }
    }
    return null;
  };

  const fetchPage = async (page: number) => {
    const data = await fetchWithRetries(page);
    if (!data) return { projects: [] as GtrProject[], count: 0, failed: true as const };
    const bean = data.facetedSearchResultBean ?? {};
    if (typeof bean.totalPages === "number") totalPages = bean.totalPages;
    if (typeof bean.totalResults === "number") totalResults = bean.totalResults;
    const results = (bean.results ?? []) as GtrProjectSearchResult[];
    const projects = results
      .map((r) => r?.projectComposition?.project)
      .filter(Boolean) as GtrProject[];
    return { projects, count: projects.length, failed: false as const };
  };

  const first = await fetchPage(1);
  pagesFetched++;
  if (first.failed) {
    console.error(`${args.label}: failed to fetch page 1 after retries.`);
    return { projects: [], pagesFetched, totalPages: null as number | null, totalResults: null as number | null };
  }
  for (const p of first.projects) {
    const id = String(p.id ?? "").trim();
    if (!id) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    all.push(p);
  }

  const cappedTotal = totalPages != null ? Math.min(totalPages, MAX_PAGES) : null;
  console.log(
    `${args.label}: page 1${cappedTotal ? ` of ${cappedTotal}` : ""}, ${first.count} projects (totalResults=${totalResults ?? "?"})`
  );

  if (cappedTotal != null) {
    for (let page = 2; page <= cappedTotal; page++) {
      await sleep(REQUEST_DELAY_MS);
      const { projects, failed } = await fetchPage(page);
      pagesFetched++;
      if (failed) {
        console.warn(`${args.label}: giving up on page ${page} after retries; continuing.`);
        continue;
      }
      for (const p of projects) {
        const id = String(p.id ?? "").trim();
        if (!id) continue;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        all.push(p);
      }
      console.log(`${args.label}: page ${page} of ${cappedTotal}, totalFetched=${all.length}`);
    }
    return { projects: all, pagesFetched, totalPages: cappedTotal, totalResults };
  }

  for (let page = 2; page <= MAX_PAGES; page++) {
    await sleep(REQUEST_DELAY_MS);
    const { projects, count, failed } = await fetchPage(page);
    pagesFetched++;
    if (failed) {
      console.warn(`${args.label}: giving up on page ${page} after retries; continuing.`);
      continue;
    }
    for (const p of projects) {
      const id = String(p.id ?? "").trim();
      if (!id) continue;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      all.push(p);
    }
    console.log(`${args.label}: page ${page}, ${count} projects, totalFetched=${all.length}`);
    if (count === 0) break;
  }

  return { projects: all, pagesFetched, totalPages: null, totalResults };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const supabase = getSupabaseService();
  let errors = 0;

  const primary = await fetchAllProjectsViaSearch({
    label: "GtR search(term=*)",
    term: "*",
  });

  const byId = new Map<string, GtrProject>();
  for (const p of [...primary.projects]) {
    const id = String(p.id ?? "").trim();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, p);
  }
  const projects = [...byId.values()];
  const totalPages = primary.totalPages ?? null;
  console.log(
    `Fetched ${projects.length} unique projects (${primary.pagesFetched} pages).`
  );

  const rows = projects.map(mapProjectToGrantAwarded).filter(Boolean) as Array<Record<string, unknown>>;
  console.log(`Mapped ${rows.length} award rows (skipped zero-amount awards).`);
  if (rows.length === 0) {
    console.log(`No rows to upsert. Errors: ${errors}.`);
    return;
  }

  // Insert only truly new rows (based on existing funder_id for this source).
  const funderIds = rows.map((r) => String((r as { funder_id?: unknown }).funder_id ?? "")).filter(Boolean);
  const existing = new Set<string>();
  for (const batch of chunk(funderIds, 800)) {
    const res = await supabase
      .from("grants_awarded")
      .select("funder_id")
      .eq("source", SOURCE)
      .in("funder_id", batch);
    if (res.error) {
      errors++;
      console.warn("Failed checking existing grants_awarded:", res.error.message);
      continue;
    }
    for (const r of res.data ?? []) {
      const id = String((r as { funder_id?: unknown }).funder_id ?? "").trim();
      if (id) existing.add(id);
    }
  }

  const toInsert = rows.filter((r) => {
    const id = String((r as { funder_id?: unknown }).funder_id ?? "").trim();
    if (!id) return false;
    return !existing.has(id);
  });

  let inserted = 0;
  for (const batch of chunk(toInsert, 500)) {
    const res = await supabase
      .from("grants_awarded")
      .upsert(batch, { onConflict: "funder_id", ignoreDuplicates: false })
      .select("id");
    if (res.error) {
      errors++;
      console.error("Upsert grants_awarded error:", res.error.message);
    } else {
      inserted += (res.data ?? []).length;
    }
  }

  console.log(
    `Complete: ${totalPages ?? "unknown"} pages, ${projects.length} projects, ${inserted} inserted`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
