/**
 * Types for the UnitasFund scoring engine.
 * Align with Supabase organisations and opportunities tables.
 */

export type OrgType = "vcse" | "sme" | "cic" | "other";

/** Organisation profile used for fit scoring (from DB or onboarding). */
export interface OrgProfile {
  id?: string;
  name: string;
  org_type: OrgType;
  location_region: string | null;
  annual_income_band: string | null;
  sectors: string[];
  funding_goals?: string | null;
}

/** Funding opportunity (from DB or scraper). */
export interface Opportunity {
  id?: string;
  title: string;
  source_id?: string;
  description?: string | null;
  url?: string | null;
  funder_name?: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_text?: string | null;
  deadline: string | null; // ISO date or null
  eligibility_summary?: string | null;
  /** Regions allowed (e.g. ["Cumbria", "UK-wide", "North West"]). */
  location_filters?: string[] | Record<string, unknown>;
  /** Sectors/themes (e.g. ["Community", "Health"]). */
  sector_filters?: string[] | Record<string, unknown>;
  /** Income bands eligible (e.g. ["Under £10k", "£10k-£50k"]). */
  income_bands?: string[] | Record<string, unknown>;
}

/** Fit score breakdown: each component 0–25, total 0–100. */
export interface FitBreakdown {
  location_score: number;
  sector_score: number;
  income_score: number;
  deadline_score: number;
}

export interface FitScore {
  fit_score: number; // 0–100
  fit_breakdown: FitBreakdown;
  match_reasons: string[];
}

export interface EVScore {
  win_probability: number; // 0–1
  expected_value: number;
  bid_cost_estimate: number;
  estimated_award_value: number;
}

export interface ScoreResult {
  fit: FitScore;
  ev: EVScore;
  /** Combined expected value after bid cost: EV − bid_cost_estimate */
  expected_value_net: number;
}
