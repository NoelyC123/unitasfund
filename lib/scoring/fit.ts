/**
 * Fit scoring: how well does this opportunity match this organisation?
 * Pure function, no side effects. Each component 0–25, total 0–100.
 */

import type { FitBreakdown, FitScore, OrgProfile, Opportunity } from "./types";

const COMPONENT_MAX = 25;
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

/** Location: does the opportunity’s geography allow the org’s region? */
function scoreLocation(org: OrgProfile, opportunity: Opportunity): number {
  const orgRegion = normaliseRegion(org.location_region);
  if (!orgRegion) return COMPONENT_MAX; // No org region: assume eligible

  const allowed = normaliseStringList(opportunity.location_filters);
  if (allowed.length === 0) return COMPONENT_MAX; // No filter: UK-wide

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
  if (oppSectors.length === 0) return COMPONENT_MAX; // No filter: any sector

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
  if (allowed.length === 0) return COMPONENT_MAX; // No restriction

  const match = allowed.some(
    (a) => a === orgBand || orgBand.includes(a) || a.includes(orgBand)
  );
  return match ? COMPONENT_MAX : 0;
}

/** Deadline: is the deadline more than 3 weeks away (or open)? */
function scoreDeadline(opportunity: Opportunity): number {
  const d = opportunity.deadline;
  if (!d || !d.trim()) return COMPONENT_MAX; // Open deadline

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

function buildMatchReasons(
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

/**
 * Compute fit score (0–100) and breakdown. Pure function.
 */
export function scoreFit(org: OrgProfile, opportunity: Opportunity): FitScore {
  const location_score = scoreLocation(org, opportunity);
  const sector_score = scoreSector(org, opportunity);
  const income_score = scoreIncome(org, opportunity);
  const deadline_score = scoreDeadline(opportunity);

  const fit_breakdown: FitBreakdown = {
    location_score,
    sector_score,
    income_score,
    deadline_score,
  };

  const fit_score = Math.min(
    100,
    Math.round(
      location_score + sector_score + income_score + deadline_score
    )
  );

  const match_reasons = buildMatchReasons(org, opportunity, fit_breakdown);

  return {
    fit_score,
    fit_breakdown,
    match_reasons,
  };
}
