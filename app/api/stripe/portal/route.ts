import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { getSupabaseService } from "@/lib/db/client";
import { getStripe } from "@/lib/stripe/client";

export async function POST() {
  const stripe = getStripe();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const service = getSupabaseService();
  const { data } = await service
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const stripeCustomerId = (data?.stripe_customer_id as string | null) ?? null;
  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer found for this user." },
      { status: 400 }
    );
  }

  const siteUrl = process.env.SITE_URL ?? "https://unitasfund.vercel.app";
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${siteUrl}/settings`,
  });

  return NextResponse.json({ url: portalSession.url });
}

