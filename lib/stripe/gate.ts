import { PLANS, type PlanId } from "./plans";

export type PlanLimits = (typeof PLANS)[PlanId]["limits"];

export function isPaidPlan(plan: PlanId): boolean {
  return plan !== "free";
}

export function canViewFullReasons(plan: PlanId): boolean {
  return Boolean(PLANS[plan].limits.full_reasons);
}

export function canViewEvDetail(plan: PlanId): boolean {
  return Boolean(PLANS[plan].limits.ev_detail);
}

export function pipelineLimitFor(plan: PlanId): number {
  return Number(PLANS[plan].limits.pipeline_items);
}

export function pipelineLimitReached(args: {
  plan: PlanId;
  pipelineCount: number;
}): boolean {
  const limit = pipelineLimitFor(args.plan);
  if (!Number.isFinite(limit) || limit < 0) return false;
  return args.pipelineCount >= limit;
}

