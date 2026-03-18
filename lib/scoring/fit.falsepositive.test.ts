import { describe, expect, it } from "vitest";
import { scoreFit } from "./fit";
import type { OrgProfile, Opportunity } from "./types";

describe("false-positive penalties", () => {
  it("penalises farming/agriculture terms for VCSE/CIC orgs", () => {
    const org: OrgProfile = {
      name: "Test VCSE",
      org_type: "vcse",
      location_region: "Cumbria",
      annual_income_band: "£10k-£50k",
      sectors: ["Community"],
    };

    const opp: Opportunity = {
      title: "Farming Equipment and Technology Fund",
      description: "Support for agricultural equipment and livestock improvements.",
      source_id: "govuk_funding",
      amount_min: null,
      amount_max: null,
      deadline: null,
      sector_filters: ["community"], // would otherwise look like a strong match
      location_filters: ["uk"],
      income_bands: [],
    };

    const res = scoreFit(org, opp);
    expect(res.fit_score).toBeLessThan(50);
  });
});

