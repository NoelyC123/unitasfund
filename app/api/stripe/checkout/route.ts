import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getSupabaseService } from "@/lib/db/client";
import { getStripe } from "@/lib/stripe/client";
import { PLANS, type PlanId } from "@/lib/stripe/plans";

type Body = { priceId?: string; planId?: PlanId };

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
  const priceId = body?.priceId;
  if (!planId || typeof planId !== "string") {
    return NextResponse.json({ error: "planId is required." }, { status: 400 });
  }
  if (!(planId in PLANS) || planId === "free") {
    return NextResponse.json({ error: "Invalid planId." }, { status: 400 });
  }
  if (!priceId || typeof priceId !== "string") {
    return NextResponse.json({ error: "priceId is required." }, { status: 400 });
  }
  const expectedPriceId = PLANS[planId].priceId;
  if (!expectedPriceId || expectedPriceId !== priceId) {
    return NextResponse.json({ error: "priceId does not match planId." }, { status: 400 });
  }

  const service = getSupabaseService();
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

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: "https://unitasfund.vercel.app/dashboard?upgraded=true",
    cancel_url: "https://unitasfund.vercel.app/pricing",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId: user.id, planId },
    subscription_data: { metadata: { userId: user.id, planId } },
  });

  return NextResponse.json({ url: session.url });
}

