/**
 * Tests for the scoring engine using real-world style data.
 * Run with: npx vitest run lib/scoring/scoring.test.ts
 * Or: node --test lib/scoring/scoring.test.ts (if using Node test runner)
 */

import { describe, it, expect } from "vitest";
import { scoreFit, scoreEV, scoreOpportunity } from "./index";
import type { OrgProfile, Opportunity } from "./types";

// Real-world example: VCSE in Cumbria (from UnitasConnect target profile)
const vcseCumbria: OrgProfile = {
  name: "South Lakes Community Project",
  org_type: "vcse",
  location_region: "Cumbria",
  annual_income_band: "£10k-£50k",
  sectors: ["Community", "Health", "Education"],
  funding_goals: "Core costs and a new community hub",
};

// National Lottery Community Fund — Awards for All (typical eligibility)
const awardsForAll: Opportunity = {
  title: "National Lottery Awards for All",
  source_id: "nlcf",
  description: "Grants of £300 to £10,000 for community projects.",
  funder_name: "National Lottery Community Fund",
  amount_min: 300,
  amount_max: 10_000,
  amount_text: "£300 – £10,000",
  deadline: null, // Rolling
  eligibility_summary: "Voluntary and community organisations across the UK.",
  location_filters: ["England", "UK-wide", "Scotland", "Wales", "Northern Ireland"],
  sector_filters: ["Community", "Health", "Education", "Environment", "Arts & Culture"],
  income_bands: ["Under £10k", "£10k-£50k", "£50k-£100k"],
};

describe("scoreFit", () => {
  it("scores a VCSE in Cumbria against National Lottery Awards for All highly", () => {
    const result = scoreFit(vcseCumbria, awardsForAll);

    expect(result.fit_score).toBeGreaterThanOrEqual(75);
    expect(result.fit_score).toBeLessThanOrEqual(100);

    // Location: England/UK-wide includes Cumbria
    expect(result.fit_breakdown.location_score).toBe(25);

    // Sector: Community, Health, Education overlap
    expect(result.fit_breakdown.sector_score).toBe(25);

    // Income: £10k-£50k is in the list
    expect(result.fit_breakdown.income_score).toBe(25);

    // Deadline: rolling = full marks
    expect(result.fit_breakdown.deadline_score).toBe(25);

    expect(result.match_reasons.length).toBeGreaterThan(0);
    expect(result.match_reasons.some((r) => r.toLowerCase().includes("region"))).toBe(true);
    expect(result.match_reasons.some((r) => r.toLowerCase().includes("sector") || r.toLowerCase().includes("match"))).toBe(true);
  });

  it("returns location_score 0 when opportunity excludes org region", () => {
    const oppScotlandOnly: Opportunity = {
      ...awardsForAll,
      location_filters: ["Scotland"],
    };
    const result = scoreFit(vcseCumbria, oppScotlandOnly);
    expect(result.fit_breakdown.location_score).toBe(0);
    expect(result.fit_score).toBeLessThan(100);
  });

  it("returns deadline_score 0 when deadline has passed", () => {
    const pastDeadline: Opportunity = {
      ...awardsForAll,
      deadline: "2020-01-01",
    };
    const result = scoreFit(vcseCumbria, pastDeadline);
    expect(result.fit_breakdown.deadline_score).toBe(0);
  });

  it("returns income_score 0 when org income band not in opportunity bands", () => {
    const highIncomeOnly: Opportunity = {
      ...awardsForAll,
      income_bands: ["£500k+"],
    };
    const result = scoreFit(vcseCumbria, highIncomeOnly);
    expect(result.fit_breakdown.income_score).toBe(0);
  });

  it("handles empty or missing filters (treats as open)", () => {
    const openOpp: Opportunity = {
      title: "Open fund",
      amount_min: null,
      amount_max: null,
      deadline: null,
      location_filters: [],
      sector_filters: [],
      income_bands: [],
    };
    const result = scoreFit(vcseCumbria, openOpp);
    expect(result.fit_breakdown.location_score).toBe(25);
    expect(result.fit_breakdown.sector_score).toBe(25);
    expect(result.fit_breakdown.income_score).toBe(25);
    expect(result.fit_breakdown.deadline_score).toBe(25);
    expect(result.fit_score).toBe(100);
  });
});

describe("scoreEV", () => {
  it("derives win_probability from fit_score", () => {
    const fit = scoreFit(vcseCumbria, awardsForAll);
    const ev = scoreEV(fit, awardsForAll);

    expect(ev.win_probability).toBeGreaterThan(0);
    expect(ev.win_probability).toBeLessThanOrEqual(1);
    expect(ev.win_probability).toBeCloseTo(fit.fit_score / 100, 2);
  });

  it("uses midpoint of amount_min and amount_max for estimated_award_value", () => {
    const fit = scoreFit(vcseCumbria, awardsForAll);
    const ev = scoreEV(fit, awardsForAll);

    const expectedMid = (300 + 10_000) / 2;
    expect(ev.estimated_award_value).toBe(expectedMid);
  });

  it("expected_value = win_probability × estimated_award_value", () => {
    const fit = scoreFit(vcseCumbria, awardsForAll);
    const ev = scoreEV(fit, awardsForAll);

    const expected = ev.win_probability * ev.estimated_award_value;
    expect(ev.expected_value).toBeCloseTo(expected, 2);
  });

  it("bid_cost_estimate is positive and scales with amount", () => {
    const fit = scoreFit(vcseCumbria, awardsForAll);
    const ev = scoreEV(fit, awardsForAll);

    expect(ev.bid_cost_estimate).toBeGreaterThan(0);
    expect(ev.bid_cost_estimate).toBe(200); // £10k band
  });
});

describe("scoreOpportunity", () => {
  it("combines fit and EV and returns expected_value_net", () => {
    const result = scoreOpportunity(vcseCumbria, awardsForAll);

    expect(result.fit.fit_score).toBe(100);
    expect(result.ev.win_probability).toBe(1);
    expect(result.ev.expected_value).toBe(5150); // 1 × 5150
    expect(result.expected_value_net).toBeCloseTo(
      result.ev.expected_value - result.ev.bid_cost_estimate,
      2
    );
  });

  it("Lancaster org matches North Lancashire / UK-wide opportunity", () => {
    const lancasterOrg: OrgProfile = {
      name: "Lancaster District CVS",
      org_type: "vcse",
      location_region: "Lancaster",
      annual_income_band: "£50k-£100k",
      sectors: ["Community", "Employment"],
    };
    const result = scoreOpportunity(lancasterOrg, awardsForAll);
    expect(result.fit.fit_breakdown.location_score).toBe(25);
  });
});
