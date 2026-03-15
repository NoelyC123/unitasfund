/**
 * Expected value scoring: win probability × award value, minus bid cost.
 * Pure function. win_probability derived from fit_score; bid cost from complexity.
 */

import type { EVScore, FitScore, Opportunity } from "./types";

/**
 * Estimate award value from opportunity (midpoint of min–max, or default).
 */
function estimatedAwardValue(opportunity: Opportunity): number {
  const min = opportunity.amount_min ?? 0;
  const max = opportunity.amount_max ?? 0;
  if (min > 0 && max >= min) return (min + max) / 2;
  if (max > 0) return max;
  if (min > 0) return min;
  // No amount: use a conservative default (e.g. small grant)
  return 5000;
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
