import Anthropic from "@anthropic-ai/sdk";
import type { OrgProfile, Opportunity } from "./types";

export type EligibilityCertainty =
  | "strong_match"
  | "likely_eligible"
  | "check_eligibility"
  | "unlikely_match";

export async function assessEligibility(
  org: OrgProfile,
  opportunity: Opportunity
): Promise<{ certainty: EligibilityCertainty; reasoning: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      certainty: "check_eligibility",
      reasoning: "Unable to assess automatically.",
    };
  }

  const client = new Anthropic({ apiKey });

  const system =
    'You are a UK funding eligibility assessor. Given an organisation profile and a funding opportunity, assess how likely the organisation is to be eligible.\nRespond with ONLY a JSON object: { "certainty": "...", "reasoning": "..." }\ncertainty must be one of: strong_match, likely_eligible, check_eligibility, unlikely_match.\nreasoning must be 1-2 sentences explaining why.';

  const orgBlock = {
    name: org.name,
    type: org.org_type,
    region: org.location_region,
    income_band: org.annual_income_band,
    sectors: org.sectors ?? [],
  };

  const oppBlock = {
    title: opportunity.title,
    funder_name: opportunity.funder_name ?? null,
    amount_text: opportunity.amount_text ?? null,
    amount_min: opportunity.amount_min ?? null,
    amount_max: opportunity.amount_max ?? null,
    location_filters: opportunity.location_filters ?? null,
    sector_filters: opportunity.sector_filters ?? null,
    description: opportunity.description ?? null,
    eligibility_summary: opportunity.eligibility_summary ?? null,
  };

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system,
      messages: [
        {
          role: "user",
          content: `Organisation:\n${JSON.stringify(orgBlock, null, 2)}\n\nOpportunity:\n${JSON.stringify(
            oppBlock,
            null,
            2
          )}`,
        },
      ],
    });

    const text =
      msg.content
        ?.map((b) => (b.type === "text" ? b.text : ""))
        .join("\n")
        .trim() ?? "";

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return { certainty: "check_eligibility", reasoning: "Unable to assess automatically." };
    }

    const parsed = JSON.parse(match[0]) as { certainty?: string; reasoning?: string };
    const certainty = parsed.certainty as EligibilityCertainty | undefined;
    const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "";

    const allowed: EligibilityCertainty[] = [
      "strong_match",
      "likely_eligible",
      "check_eligibility",
      "unlikely_match",
    ];

    if (!certainty || !allowed.includes(certainty)) {
      return { certainty: "check_eligibility", reasoning: "Unable to assess automatically." };
    }

    return {
      certainty,
      reasoning: reasoning || "Unable to assess automatically.",
    };
  } catch {
    return {
      certainty: "check_eligibility",
      reasoning: "Unable to assess automatically.",
    };
  }
}

