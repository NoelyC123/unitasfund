import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { getSupabaseService } from "@/lib/db/client";
import { getPlanFromPriceId, PLANS, type PlanId } from "@/lib/stripe/plans";

export const runtime = "nodejs";

// NOTE: In the Next.js App Router, we must read the raw body via request.text()
// for Stripe signature verification.

function unixToIso(ts: number | null | undefined): string | null {
  if (!ts || !Number.isFinite(ts)) return null;
  return new Date(ts * 1000).toISOString();
}

async function upsertSubscriptionByUserId(args: {
  userId: string;
  plan: PlanId;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}) {
  const service = getSupabaseService();
  await service.from("subscriptions").upsert(
    {
      user_id: args.userId,
      plan: args.plan,
      status: args.status,
      stripe_customer_id: args.stripeCustomerId,
      stripe_subscription_id: args.stripeSubscriptionId,
      current_period_start: args.currentPeriodStart,
      current_period_end: args.currentPeriodEnd,
    },
    { onConflict: "user_id" }
  );
}

async function updateSubscriptionByStripeIds(args: {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  patch: Record<string, unknown>;
}) {
  const service = getSupabaseService();
  let q = service.from("subscriptions").update(args.patch);
  if (args.stripeSubscriptionId) q = q.eq("stripe_subscription_id", args.stripeSubscriptionId);
  else if (args.stripeCustomerId) q = q.eq("stripe_customer_id", args.stripeCustomerId);
  else return;
  await q;
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const raw = await request.text();

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = String(session?.metadata?.userId ?? "");
        const planId = String(session?.metadata?.planId ?? "") as PlanId;
        if (!userId) break;
        const safePlan: PlanId = planId in PLANS ? planId : "free";

        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        let currentPeriodStart: string | null = null;
        let currentPeriodEnd: string | null = null;
        let status: string = "active";

        if (stripeSubscriptionId) {
          const sub: any = await stripe.subscriptions.retrieve(stripeSubscriptionId);
          currentPeriodStart = unixToIso(sub?.current_period_start);
          currentPeriodEnd = unixToIso(sub?.current_period_end);
          status = String(sub?.status ?? "active");
        }

        await upsertSubscriptionByUserId({
          userId,
          plan: safePlan,
          status: status === "active" ? "active" : status,
          stripeCustomerId,
          stripeSubscriptionId,
          currentPeriodStart,
          currentPeriodEnd,
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as any;
        const stripeCustomerId = String(sub.customer ?? "");
        const stripeSubscriptionId = String(sub.id ?? "");
        const currentPeriodStart = unixToIso(sub.current_period_start);
        const currentPeriodEnd = unixToIso(sub.current_period_end);
        const status = String(sub.status ?? "active");

        const priceId = String(sub.items?.data?.[0]?.price?.id ?? "");
        const inferredPlan = priceId ? getPlanFromPriceId(priceId) : "free";

        const userId = String(sub.metadata?.userId ?? "");
        if (userId) {
          await upsertSubscriptionByUserId({
            userId,
            plan: inferredPlan,
            status,
            stripeCustomerId: stripeCustomerId || null,
            stripeSubscriptionId: stripeSubscriptionId || null,
            currentPeriodStart,
            currentPeriodEnd,
          });
        } else {
          await updateSubscriptionByStripeIds({
            stripeCustomerId: stripeCustomerId || null,
            stripeSubscriptionId: stripeSubscriptionId || null,
            patch: {
              status,
              plan: inferredPlan,
              current_period_start: currentPeriodStart,
              current_period_end: currentPeriodEnd,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const stripeCustomerId = String(sub.customer ?? "");
        const stripeSubscriptionId = String(sub.id ?? "");
        const userId = String(sub.metadata?.userId ?? "");

        if (userId) {
          await upsertSubscriptionByUserId({
            userId,
            plan: "free",
            status: "cancelled",
            stripeCustomerId: stripeCustomerId || null,
            stripeSubscriptionId: stripeSubscriptionId || null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
          });
        } else {
          await updateSubscriptionByStripeIds({
            stripeCustomerId: stripeCustomerId || null,
            stripeSubscriptionId: stripeSubscriptionId || null,
            patch: { status: "cancelled", plan: "free" },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const stripeCustomerId = String(invoice.customer ?? "");
        const stripeSubscriptionId = String(invoice.subscription ?? "");
        await updateSubscriptionByStripeIds({
          stripeCustomerId: stripeCustomerId || null,
          stripeSubscriptionId: stripeSubscriptionId || null,
          patch: { status: "past_due" },
        });
        break;
      }
      default:
        break;
    }
  } catch {
    // Always return 200 for handled events to avoid webhook retries for transient DB issues.
  }

  return NextResponse.json({ received: true });
}

