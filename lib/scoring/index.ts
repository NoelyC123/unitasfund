/**
 * UnitasFund scoring engine: fit + EV in one call.
 */

import { scoreEV } from "./ev";
import { scoreFit } from "./fit";
import type { OrgProfile, Opportunity, ScoreResult } from "./types";

export type { EVScore, FitBreakdown, FitScore, OrgProfile, Opportunity, ScoreResult } from "./types";
export { scoreFit } from "./fit";
export { scoreEV } from "./ev";

/**
 * Score one opportunity for one organisation. Returns fit, EV, and net expected value.
 */
export function scoreOpportunity(
  org: OrgProfile,
  opportunity: Opportunity
): ScoreResult {
  const fit = scoreFit(org, opportunity);
  const ev = scoreEV(fit, opportunity);
  const expected_value_net = Math.round(
    (ev.expected_value - ev.bid_cost_estimate) * 100
  ) / 100;

  return {
    fit,
    ev,
    expected_value_net,
  };
}
