export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    priceId: null,
    features: [
      "All grant matches visible",
      "Basic fit score",
      "Up to 5 pipeline items",
      "1 organisation profile",
    ],
    limits: {
      pipeline_items: 5,
      orgs: 1,
      full_reasons: false,
      ev_detail: false,
      alerts: false,
      exports: false,
    },
  },
  starter: {
    name: "Starter",
    monthlyPrice: 35,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    features: [
      "All grant matches with full reasons",
      "Full EV and confidence scores",
      "Unlimited pipeline",
      "Weekly email alerts",
      "1 organisation profile",
    ],
    limits: {
      pipeline_items: -1,
      orgs: 1,
      full_reasons: true,
      ev_detail: true,
      alerts: true,
      exports: false,
    },
  },
  pro: {
    name: "Pro",
    monthlyPrice: 89,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    features: [
      "Everything in Starter",
      "CSV and PDF exports",
      "Deadline reminder alerts",
      "Change detection alerts",
      "Priority support",
    ],
    limits: {
      pipeline_items: -1,
      orgs: 1,
      full_reasons: true,
      ev_detail: true,
      alerts: true,
      exports: true,
    },
  },
  team: {
    name: "Team",
    monthlyPrice: 199,
    priceId: process.env.STRIPE_TEAM_PRICE_ID,
    features: [
      "Everything in Pro",
      "Up to 5 team members",
      "Multiple org profiles",
      "Shared pipeline",
      "Org switcher",
    ],
    limits: {
      pipeline_items: -1,
      orgs: 5,
      full_reasons: true,
      ev_detail: true,
      alerts: true,
      exports: true,
      team_members: 5,
    },
  },
  adviser: {
    name: "Adviser",
    monthlyPrice: 399,
    priceId: process.env.STRIPE_ADVISER_PRICE_ID,
    features: [
      "Everything in Team",
      "Unlimited client organisations",
      "Adviser dashboard",
      "Per-client PDF reports",
      "API access",
    ],
    limits: {
      pipeline_items: -1,
      orgs: -1,
      full_reasons: true,
      ev_detail: true,
      alerts: true,
      exports: true,
      team_members: -1,
    },
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlanFromPriceId(priceId: string): PlanId {
  for (const [key, plan] of Object.entries(PLANS)) {
    if ("priceId" in plan && plan.priceId === priceId) {
      return key as PlanId;
    }
  }
  return "free";
}

