/**
 * Expected value scoring: win probability × award value, minus bid cost.
 * Pure function. win_probability derived from fit_score; bid cost from complexity.
 */

import type { EVScore, FitScore, Opportunity } from "./types";

const MAX_ESTIMATED_AWARD_VALUE = 500_000;
const UNRELIABLE_AWARD_VALUE_THRESHOLD = 1_000_000;
const EV_BLOCKED_SOURCES = new Set(["tudor_trust", "garfield_weston", "lloyds_bank_foundation"]);

function isAwardValueUnreliable(opportunity: Opportunity): boolean {
  const amountText = (opportunity.amount_text ?? "").toLowerCase();
  if (amountText.includes("million")) return true;
  if (amountText.includes("budget")) return true;
  const max = opportunity.amount_max ?? 0;
  if (max > UNRELIABLE_AWARD_VALUE_THRESHOLD) return true;
  return false;
}

/**
 * Estimate award value from opportunity (midpoint of min–max, or default).
 */
function estimatedAwardValue(opportunity: Opportunity): number {
  const min = opportunity.amount_min ?? 0;
  const max = opportunity.amount_max ?? 0;
  let estimated = 0;
  if (min > 0 && max >= min) estimated = (min + max) / 2;
  else if (max > 0) estimated = max;
  else if (min > 0) estimated = min;
  else estimated = 5000; // No amount: conservative default (small grant)

  // FIX 1.1: Cap estimated award value for EV calculation.
  if (estimated > MAX_ESTIMATED_AWARD_VALUE) return MAX_ESTIMATED_AWARD_VALUE;
  return estimated;
}

/**
 * Simple bid cost estimate from application size (amount band).
 */
function bidCostEstimate(opportunity: Opportunity): number {
  const amount = estimatedAwardValue(opportunity);
  if (amount <= 10_000) return 200;
  if (amount <= 50_000) return 500;
  if (amount <= 250_000) return 1200;
  return 2500;
}

/**
 * Derive win probability (0–1) from fit score (0–100).
 * Linear for MVP; can use a curve later.
 */
function fitToWinProbability(fitScore: number): number {
  const clamped = Math.max(0, Math.min(100, fitScore));
  return clamped / 100;
}

/**
 * Compute EV score from fit result and opportunity. Pure function.
 */
export function scoreEV(fitScore: FitScore, opportunity: Opportunity): EVScore {
  // FIX 1.3: Prevent EV display for funder-info scrapers (programme pages, not grants).
  if (EV_BLOCKED_SOURCES.has(String(opportunity.source_id ?? "").toLowerCase().trim())) {
    return { win_probability: 0, expected_value: 0, bid_cost_estimate: 0, estimated_award_value: 0 };
  }

  // FIX 1.2: If award amount looks like a programme budget, treat EV as unavailable.
  if (isAwardValueUnreliable(opportunity)) {
    return { win_probability: 0, expected_value: 0, bid_cost_estimate: 0, estimated_award_value: 0 };
  }

  const win_probability = fitToWinProbability(fitScore.fit_score);
  const estimated_award_value = estimatedAwardValue(opportunity);
  const bid_cost_estimate = bidCostEstimate(opportunity);
  const expected_value = win_probability * estimated_award_value;

  return {
    win_probability,
    expected_value: Math.round(expected_value * 100) / 100,
    bid_cost_estimate,
    estimated_award_value,
  };
}
