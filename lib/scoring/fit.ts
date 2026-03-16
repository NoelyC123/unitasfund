/**
 * Fit scoring: how well does this opportunity match this organisation?
 * Pure function, no side effects. Each component 0–25, total 0–100.
 */

import type { FitBreakdown, FitScore, OrgProfile, Opportunity } from "./types";

const COMPONENT_MAX = 25;
const UNKNOWN_SCORE = 12.5; // When a filter is empty, treat as unknown (50 total if all empty)
const WEEKS_FOR_FULL_DEADLINE = 3;

function normaliseStringList(
  value: string[] | Record<string, unknown> | undefined
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((s) => String(s).trim().toLowerCase());
  if (typeof value === "object") {
    const arr = Object.values(value).filter((v) => typeof v === "string");
    return arr.map((s) => String(s).trim().toLowerCase());
  }
  return [];
}

function normaliseRegion(s: string | null | undefined): string {
  if (!s || !s.trim()) return "";
  return s.trim().toLowerCase();
}

/** Sector keywords (lowercase) → canonical sector name for matching. */
const SECTOR_KEYWORDS: { pattern: RegExp; sector: string }[] = [
  { pattern: /\bcommunity\b/i, sector: "community" },
  { pattern: /\benvironment(al)?\b/i, sector: "environment" },
  { pattern: /\bhealth\b/i, sector: "health" },
  { pattern: /\barts?\b|\bculture\b|\bcultural\b/i, sector: "arts & culture" },
  { pattern: /\beducation\b/i, sector: "education" },
  { pattern: /\bhousing\b/i, sector: "housing" },
  { pattern: /\bemployment\b|\bjobs?\b|\bwork(force)?\b/i, sector: "employment" },
  { pattern: /\bsme\b|\bsmall business\b/i, sector: "sme" },
  { pattern: /\bresearch\b/i, sector: "research" },
  { pattern: /\bsport\b|\bphysical activity\b/i, sector: "sport" },
  { pattern: /\bheritage\b/i, sector: "heritage" },
  { pattern: /\byouth\b|\bchildren\b|\bfamil(y|ies)\b/i, sector: "youth" },
];

/** Location keywords (lowercase) → canonical region for matching. */
const LOCATION_KEYWORDS: { pattern: RegExp; region: string }[] = [
  { pattern: /\bcumbria\b/i, region: "cumbria" },
  { pattern: /\b(uk|united kingdom)\b/i, region: "uk" },
  { pattern: /\bengland\b/i, region: "england" },
  { pattern: /\bscotland\b/i, region: "scotland" },
  { pattern: /\bwales\b/i, region: "wales" },
  { pattern: /\bnorthern ireland\b/i, region: "northern ireland" },
  { pattern: /\bnational\b|\buk-wide\b|\buk wide\b/i, region: "uk-wide" },
  { pattern: /\bnorth west\b|\bnorthwest\b/i, region: "north west" },
  { pattern: /\blancaster\b|\blancashire\b|\bnorth lancashire\b/i, region: "north lancashire" },
];

/** Org type keywords (for reference; we don't override income). */
const ORG_TYPE_KEYWORDS: { pattern: RegExp; type: string }[] = [
  { pattern: /\bcharity\b|\bcharities\b/i, type: "vcse" },
  { pattern: /\bvcse\b|\bvoluntary\b|\bcommunity (org|group|sector)\b/i, type: "vcse" },
  { pattern: /\bsmall business\b|\bsme\b|\benterprise\b/i, type: "sme" },
  { pattern: /\bcic\b|\bcommunity interest\b/i, type: "cic" },
];

export interface InferredFilters {
  inferredSectors: string[];
  inferredRegions: string[];
  inferredOrgTypes: string[];
}

/**
 * Infer eligibility signals from opportunity title, description, eligibility_summary,
 * funder_name and source_id.
 *
 * This is deliberately heuristic: the goal is to produce a meaningful spread of
 * scores when explicit filters are missing, not perfect classification.
 */
export function inferFiltersFromText(opportunity: Opportunity): InferredFilters {
  const textParts = [
    opportunity.title ?? "",
    opportunity.description ?? "",
    opportunity.eligibility_summary ?? "",
    opportunity.funder_name ?? "",
    opportunity.source_id ?? "",
  ];

  const text = textParts.filter(Boolean).join(" ");
  const lower = text.toLowerCase();
  const inferredSectors: string[] = [];
  const inferredRegions: string[] = [];
  const inferredOrgTypes: string[] = [];

  // Generic keyword-based sector and region inference
  for (const { pattern, sector } of SECTOR_KEYWORDS) {
    if (pattern.test(text) && !inferredSectors.includes(sector)) {
      inferredSectors.push(sector);
    }
  }
  for (const { pattern, region } of LOCATION_KEYWORDS) {
    if (pattern.test(text) && !inferredRegions.includes(region)) {
      inferredRegions.push(region);
    }
  }
  for (const { pattern, type } of ORG_TYPE_KEYWORDS) {
    if (pattern.test(text) && !inferredOrgTypes.includes(type)) {
      inferredOrgTypes.push(type);
    }
  }

  // Heuristics based on known funders / sources from the UnitasConnect scraper
  if (
    lower.includes("national lottery community fund") ||
    lower.includes("tnl community fund") ||
    lower.includes("awards for all")
  ) {
    if (!inferredSectors.includes("community")) inferredSectors.push("community");
    if (!inferredSectors.includes("arts & culture")) inferredSectors.push("arts & culture");
    if (!inferredRegions.includes("england")) inferredRegions.push("england");
    if (!inferredRegions.includes("uk-wide")) inferredRegions.push("uk-wide");
  }

  if (lower.includes("cumbria community foundation")) {
    if (!inferredSectors.includes("community")) inferredSectors.push("community");
    if (!inferredRegions.includes("cumbria")) inferredRegions.push("cumbria");
  }

  if (lower.includes("community foundation for lancashire")) {
    if (!inferredSectors.includes("community")) inferredSectors.push("community");
    if (!inferredRegions.includes("north lancashire")) {
      inferredRegions.push("north lancashire");
    }
  }

  if (lower.includes("lancaster cvs") || lower.includes("lancaster district cvs")) {
    if (!inferredSectors.includes("community")) inferredSectors.push("community");
    if (!inferredRegions.includes("north lancashire")) {
      inferredRegions.push("north lancashire");
    }
  }

  if (lower.includes("growth hub") || lower.includes("cumbria growth hub")) {
    if (!inferredSectors.includes("sme")) inferredSectors.push("sme");
    if (!inferredRegions.includes("cumbria")) inferredRegions.push("cumbria");
  }

  if (lower.includes("ukri") || lower.includes("innovate uk")) {
    if (!inferredSectors.includes("research")) inferredSectors.push("research");
    if (!inferredOrgTypes.includes("sme")) inferredOrgTypes.push("sme");
  }

  if (lower.includes("sport england")) {
    if (!inferredSectors.includes("sport")) inferredSectors.push("sport");
    if (!inferredRegions.includes("england")) inferredRegions.push("england");
  }

  return { inferredSectors, inferredRegions, inferredOrgTypes };
}

/** Location: does the opportunity’s geography allow the org’s region? */
function scoreLocation(org: OrgProfile, opportunity: Opportunity): number {
  const orgRegion = normaliseRegion(org.location_region);
  if (!orgRegion) return COMPONENT_MAX; // No org region: assume eligible

  const allowed = normaliseStringList(opportunity.location_filters);
  if (allowed.length === 0) return Math.round(UNKNOWN_SCORE); // Unknown: not a perfect match

  const ukWide = allowed.some(
    (r) =>
      r === "uk" ||
      r === "uk-wide" ||
      r === "england" ||
      r === "united kingdom"
  );
  if (ukWide) return COMPONENT_MAX;

  const orgNorm = orgRegion;
  const match = allowed.some((r) => {
    if (r === orgNorm) return true;
    if (orgNorm.includes("cumbria") && (r.includes("cumbria") || r.includes("north west")))
      return true;
    if (orgNorm.includes("lancaster") && (r.includes("lancaster") || r.includes("lancashire") || r.includes("north west")))
      return true;
    if (orgNorm.includes("lancashire") && (r.includes("lancashire") || r.includes("north west")))
      return true;
    if (r.includes(orgNorm) || orgNorm.includes(r)) return true;
    return false;
  });
  if (match) return COMPONENT_MAX;

  const partial = allowed.some(
    (r) =>
      r.includes("north") ||
      r.includes("north west") ||
      r.includes("northwest")
  );
  if (partial && (orgNorm.includes("cumbria") || orgNorm.includes("lancaster") || orgNorm.includes("lancashire")))
    return Math.round(COMPONENT_MAX * 0.7);

  return 0;
}

/** Sector: overlap between org sectors and opportunity sectors. */
function scoreSector(org: OrgProfile, opportunity: Opportunity): number {
  const orgSectors = org.sectors.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (orgSectors.length === 0) return Math.round(COMPONENT_MAX * 0.5); // Unknown: partial

  const oppSectors = normaliseStringList(opportunity.sector_filters);
  if (oppSectors.length === 0) return Math.round(UNKNOWN_SCORE); // Unknown: not a perfect match

  const overlap = orgSectors.filter((os) =>
    oppSectors.some((ops) => ops.includes(os) || os.includes(ops))
  );
  if (overlap.length > 0) return COMPONENT_MAX;
  return 0;
}

/** Income: is the org’s income band within the opportunity’s allowed bands? */
function scoreIncome(org: OrgProfile, opportunity: Opportunity): number {
  const orgBand = normaliseRegion(org.annual_income_band);
  if (!orgBand) return Math.round(COMPONENT_MAX * 0.5);

  const allowed = normaliseStringList(opportunity.income_bands);
  if (allowed.length === 0) {
    // No explicit income bands: fall back to amount range as a proxy.
    const amountRef =
      opportunity.amount_min != null
        ? Number(opportunity.amount_min)
        : opportunity.amount_max != null
        ? Number(opportunity.amount_max)
        : null;

    if (amountRef == null || Number.isNaN(amountRef)) {
      return Math.round(UNKNOWN_SCORE);
    }

    // Map organisation band and amount into rough indices 0–4 and score based on distance.
    const bandOrder = [
      "under £10k",
      "£10k-£50k",
      "£50k-£100k",
      "£100k-£500k",
      "£500k+",
    ];

    const normalisedOrgBand = orgBand.toLowerCase();
    const orgIndex =
      bandOrder.findIndex((b) => normalisedOrgBand.includes(b.replace("£", "").toLowerCase())) ?? -1;

    const amountIndex =
      amountRef <= 10_000
        ? 0
        : amountRef <= 50_000
        ? 1
        : amountRef <= 100_000
        ? 2
        : amountRef <= 500_000
        ? 3
        : 4;

    if (orgIndex === -1) {
      // Unknown org band string: treat as mid confidence when we have an amount.
      return Math.round(COMPONENT_MAX * 0.6);
    }

    const diff = Math.abs(orgIndex - amountIndex);
    if (diff === 0) return COMPONENT_MAX;
    if (diff === 1) return Math.round(COMPONENT_MAX * 0.7);
    if (diff === 2) return Math.round(COMPONENT_MAX * 0.4);
    return Math.round(COMPONENT_MAX * 0.2);
  }

  const match = allowed.some(
    (a) => a === orgBand || orgBand.includes(a) || a.includes(orgBand)
  );
  return match ? COMPONENT_MAX : 0;
}

/** Deadline: is the deadline more than 3 weeks away (or open)? */
function scoreDeadline(opportunity: Opportunity): number {
  const d = opportunity.deadline;
  if (!d || !d.trim()) return Math.round(UNKNOWN_SCORE); // Open: unknown feasibility

  const deadlineDate = new Date(d.trim());
  if (Number.isNaN(deadlineDate.getTime())) return COMPONENT_MAX;

  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffWeeks = diffMs / (7 * 24 * 60 * 60 * 1000);

  if (diffWeeks < 0) return 0;
  if (diffWeeks >= WEEKS_FOR_FULL_DEADLINE) return COMPONENT_MAX;
  if (diffWeeks >= 1) return Math.round(COMPONENT_MAX * 0.5);
  return Math.round(COMPONENT_MAX * 0.25);
}

/** Exported for dashboard UI to show plain-English score explanations. */
export function buildMatchReasons(
  org: OrgProfile,
  opportunity: Opportunity,
  breakdown: FitBreakdown
): string[] {
  const reasons: string[] = [];

  if (breakdown.location_score === COMPONENT_MAX) {
    reasons.push(
      org.location_region
        ? `Your region (${org.location_region}) is eligible for this fund.`
        : "No location restriction; your organisation is eligible."
    );
  } else if (breakdown.location_score > 0) {
    reasons.push("Your region may be partially eligible (check fund guidelines).");
  } else if (org.location_region) {
    reasons.push("This opportunity does not list your region as eligible.");
  }

  if (breakdown.sector_score === COMPONENT_MAX) {
    reasons.push(
      org.sectors.length > 0
        ? `Your sectors (${org.sectors.join(", ")}) match this opportunity.`
        : "This opportunity is open to your type of organisation."
    );
  } else if (breakdown.sector_score > 0) {
    reasons.push("Sector match is partial; check eligibility.");
  } else if (org.sectors.length > 0) {
    reasons.push("This opportunity’s focus does not match your stated sectors.");
  }

  if (breakdown.income_score === COMPONENT_MAX) {
    reasons.push(
      org.annual_income_band
        ? `Your income band (${org.annual_income_band}) is within the fund’s eligibility.`
        : "Income eligibility is not restricted."
    );
  } else if (breakdown.income_score > 0) {
    reasons.push("Income band may be acceptable; check fund criteria.");
  } else if (org.annual_income_band) {
    reasons.push("Your organisation’s income band may be outside this fund’s range.");
  }

  if (breakdown.deadline_score === COMPONENT_MAX) {
    reasons.push(
      opportunity.deadline
        ? "You have at least 3 weeks before the deadline."
        : "This fund has an open or rolling deadline."
    );
  } else if (breakdown.deadline_score > 0) {
    reasons.push("Deadline is soon; apply quickly if eligible.");
  } else if (opportunity.deadline) {
    reasons.push("The application deadline has passed.");
  }

  return reasons;
}

/** True if opportunity has no eligibility filters (unknown match). */
function hasNoEligibilityFilters(opportunity: Opportunity): boolean {
  const loc = normaliseStringList(opportunity.location_filters);
  const sec = normaliseStringList(opportunity.sector_filters);
  const inc = normaliseStringList(opportunity.income_bands);
  return loc.length === 0 && sec.length === 0 && inc.length === 0;
}

/** Research/academic keywords: poor fit for VCSE/CIC. */
const RESEARCH_TITLE_PATTERNS = [
  "research",
  "clinical",
  "phd",
  "fellowship",
  "professorship",
];

function isResearchStyleTitle(title: string | null | undefined): boolean {
  if (!title || !title.trim()) return false;
  const lower = title.trim().toLowerCase();
  return RESEARCH_TITLE_PATTERNS.some((p) => lower.includes(p));
}

/** True if VCSE/CIC should get research penalty (UKRI or research-style title). */
function shouldApplyResearchPenalty(org: OrgProfile, opportunity: Opportunity): boolean {
  const isVcseOrCic = org.org_type === "vcse" || org.org_type === "cic";
  if (!isVcseOrCic) return false;
  if (opportunity.source_id === "ukri") return true;
  return isResearchStyleTitle(opportunity.title);
}

/** Regional priority: opportunity targets Cumbria / Lancaster / North West. */
const REGIONAL_BONUS_KEYWORDS = [
  "cumbria",
  "lancaster",
  "north lancashire",
  "north west",
];

function hasRegionalBonus(opportunity: Opportunity): boolean {
  const allowed = normaliseStringList(opportunity.location_filters);
  return REGIONAL_BONUS_KEYWORDS.some((kw) =>
    allowed.some((r) => r.includes(kw) || kw.includes(r))
  );
}

const RESEARCH_PENALTY_MULTIPLIER = 0.6;
const REGIONAL_BONUS_MULTIPLIER = 1.2;

/**
 * Compute fit score (0–100) and breakdown. Pure function.
 * When explicit filters are empty, infers sectors/regions from title/description/eligibility_summary
 * to produce a spread of scores; only caps at 50 when no signal can be inferred.
 * Applies 0.6 penalty for UKRI or research-style titles for VCSE/CIC; 1.2 bonus for regional targets.
 */
export function scoreFit(org: OrgProfile, opportunity: Opportunity): FitScore {
  const inferred = inferFiltersFromText(opportunity);
  const hasExplicitFilters = !hasNoEligibilityFilters(opportunity);

  let effectiveOpportunity: Opportunity = opportunity;
  if (!hasExplicitFilters && (inferred.inferredSectors.length > 0 || inferred.inferredRegions.length > 0)) {
    effectiveOpportunity = {
      ...opportunity,
      location_filters:
        normaliseStringList(opportunity.location_filters).length > 0
          ? opportunity.location_filters
          : inferred.inferredRegions,
      sector_filters:
        normaliseStringList(opportunity.sector_filters).length > 0
          ? opportunity.sector_filters
          : inferred.inferredSectors,
    };
  }

  const location_score = scoreLocation(org, effectiveOpportunity);
  const sector_score = scoreSector(org, effectiveOpportunity);
  const income_score = scoreIncome(org, opportunity);
  const deadline_score = scoreDeadline(opportunity);

  let fit_breakdown: FitBreakdown = {
    location_score,
    sector_score,
    income_score,
    deadline_score,
  };

  let fit_score = Math.min(
    100,
    Math.round(
      location_score + sector_score + income_score + deadline_score
    )
  );

  const noExplicitAndNoInferred =
    !hasExplicitFilters &&
    inferred.inferredSectors.length === 0 &&
    inferred.inferredRegions.length === 0;

  if (noExplicitAndNoInferred) {
    fit_score = 50;
    fit_breakdown = {
      location_score: Math.round(UNKNOWN_SCORE),
      sector_score: Math.round(UNKNOWN_SCORE),
      income_score: Math.round(UNKNOWN_SCORE),
      deadline_score: Math.round(UNKNOWN_SCORE),
    };
  }

  if (shouldApplyResearchPenalty(org, opportunity)) {
    fit_score = Math.round(fit_score * RESEARCH_PENALTY_MULTIPLIER);
  }
  if (hasRegionalBonus(effectiveOpportunity)) {
    fit_score = Math.min(100, Math.round(fit_score * REGIONAL_BONUS_MULTIPLIER));
  }

  const match_reasons = buildMatchReasons(org, opportunity, fit_breakdown);

  return {
    fit_score,
    fit_breakdown,
    match_reasons,
  };
}
