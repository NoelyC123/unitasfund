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
const PAGE_SIZE = 50;
const REQUEST_DELAY_MS = 500;
const SOURCE = "ukri_gtr";

type GtrResponse<T> = {
  projectsBean?: {
    projects?: T[];
    totalPages?: number;
    page?: number;
    size?: number;
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

async function fetchJson<T>(path: string): Promise<GtrResponse<T>> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GtR ${res.status} for ${path}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as GtrResponse<T>;
}

async function fetchAllProjects(args: { pathBuilder: (p: number, s: number) => string; label: string }) {
  const all: GtrProject[] = [];
  let pagesFetched = 0;

  // GtR API sometimes omits totalPages; support both modes.
  let totalPages: number | null = null;
  for (let page = 1; ; page++) {
    const data = await fetchJson<GtrProject>(args.pathBuilder(page, PAGE_SIZE));
    const bean = data.projectsBean ?? {};
    const list = (bean.projects ?? []) as GtrProject[];
    if (typeof bean.totalPages === "number") totalPages = bean.totalPages;
    pagesFetched++;
    all.push(...list);

    console.log(
      `${args.label}: page ${page}${totalPages ? ` of ${totalPages}` : ""}, ${list.length} projects`
    );

    if (list.length === 0) break;
    if (totalPages != null && page >= totalPages) break;

    await sleep(REQUEST_DELAY_MS);
  }

  return { projects: all, pagesFetched };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const supabase = getSupabaseService();
  let errors = 0;

  const primary = await fetchAllProjects({
    label: "GtR projects",
    pathBuilder: (p, s) => `/projects?p=${p}&s=${s}`,
  }).catch((e) => {
    errors++;
    console.error("Primary fetch failed:", e instanceof Error ? e.message : String(e));
    return { projects: [] as GtrProject[], pagesFetched: 0 };
  });

  await sleep(REQUEST_DELAY_MS);

  const fallback = await fetchAllProjects({
    label: "GtR search(term=grant)",
    pathBuilder: (p, s) => `/search/project?term=grant&p=${p}&s=${s}`,
  }).catch((e) => {
    errors++;
    console.error("Fallback fetch failed:", e instanceof Error ? e.message : String(e));
    return { projects: [] as GtrProject[], pagesFetched: 0 };
  });

  const byId = new Map<string, GtrProject>();
  for (const p of [...primary.projects, ...fallback.projects]) {
    const id = String(p.id ?? "").trim();
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, p);
  }
  const projects = [...byId.values()];
  console.log(
    `Fetched ${projects.length} unique projects (${primary.pagesFetched} primary pages, ${fallback.pagesFetched} fallback pages).`
  );

  const rows = projects.map(mapProjectToGrantAwarded).filter(Boolean) as Array<Record<string, unknown>>;
  console.log(`Mapped ${rows.length} award rows (skipped zero-amount awards).`);
  if (rows.length === 0) {
    console.log(`No rows to upsert. Errors: ${errors}.`);
    return;
  }

  // De-dupe based on existing grants_awarded.funder_id for this source.
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

  if (toInsert.length === 0) {
    console.log(`Nothing new to insert. Errors: ${errors}.`);
    return;
  }

  let inserted = 0;
  for (const batch of chunk(toInsert, 500)) {
    const res = await supabase.from("grants_awarded").insert(batch).select("id");
    if (res.error) {
      errors++;
      console.error("Insert grants_awarded error:", res.error.message);
    } else {
      inserted += (res.data ?? []).length;
    }
  }

  console.log(`Inserted ${inserted} new rows into grants_awarded. Errors: ${errors}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
