import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getSupabaseService } from "@/lib/db/client";
import { getStripe } from "@/lib/stripe/client";
import { PLANS, STRIPE_PRICE_ENV_VARS, type PlanId } from "@/lib/stripe/plans";

type Body = { planId?: PlanId };

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: Body | null = null;
  try {
    body = (await request.json()) as Body;
  } catch {
    body = null;
  }

  const planId = body?.planId;
  if (!planId || typeof planId !== "string") {
    return NextResponse.json({ error: "planId is required." }, { status: 400 });
  }
  if (!(planId in PLANS) || planId === "free") {
    return NextResponse.json({ error: "Invalid planId." }, { status: 400 });
  }

  // Debug: print env var names being used and whether they are set.
  const envDebug = Object.entries(STRIPE_PRICE_ENV_VARS).reduce<Record<string, boolean>>(
    (acc, [, envName]) => {
      acc[envName] = Boolean(process.env[envName]);
      return acc;
    },
    {}
  );
  console.log("[stripe.checkout] price env vars:", envDebug);

  const expectedPriceId = PLANS[planId].priceId;
  if (!expectedPriceId) {
    const envName = STRIPE_PRICE_ENV_VARS[planId as Exclude<PlanId, "free">] ?? "(unknown)";
    return NextResponse.json(
      {
        error: "Stripe price ID is not configured for this plan.",
        debug: { expectedEnvVar: envName, envDebug },
      },
      { status: 500 }
    );
  }

  const service = getSupabaseService();
  const { data: orgRow } = await service
    .from("user_organisations")
    .select("organisation_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const organisationId = (orgRow?.organisation_id as string | null) ?? null;

  const existing = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let stripeCustomerId =
    (existing.data?.stripe_customer_id as string | null) ?? null;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: user.id },
    });
    stripeCustomerId = customer.id;

    await service.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan: "free",
        status: "cancelled",
        stripe_customer_id: stripeCustomerId,
      },
      { onConflict: "user_id" }
    );
  }

  const siteUrl = process.env.SITE_URL ?? "https://unitasfund.vercel.app";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${siteUrl}/dashboard?upgraded=true`,
    cancel_url: `${siteUrl}/pricing`,
    customer: stripeCustomerId,
    line_items: [{ price: expectedPriceId, quantity: 1 }],
    customer_email: user.email ?? undefined,
    metadata: { userId: user.id, planId, organisation_id: organisationId ?? "" },
    subscription_data: { metadata: { userId: user.id, planId, organisation_id: organisationId ?? "" } },
  });

  return NextResponse.json({ url: session.url });
}

