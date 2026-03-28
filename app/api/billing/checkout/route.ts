import { NextResponse } from "next/server";
import Stripe from "stripe";
import { appConfig } from "@/lib/config";
import { jsonError, requireUser } from "@/lib/server";
import { store } from "@/lib/store";
import { PlanId } from "@/lib/types";

function getTrialDate(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json()) as { planId?: PlanId };
  const planId = body.planId || auth.record.profile.planPreference;
  if (!planId) {
    return jsonError("Plan is required.");
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const monthlyPriceId = process.env.STRIPE_MONTHLY_PRICE_ID;
  const yearlyPriceId = process.env.STRIPE_YEARLY_PRICE_ID;

  if (!stripeKey || !monthlyPriceId || !yearlyPriceId) {
    const subscription = await store.upsertSubscription(auth.record.user.id, {
      planId,
      provider: "demo",
      status: "trialing",
      trialEndsAt: getTrialDate(7),
      currentPeriodEnd: getTrialDate(planId === "yearly" ? 365 : 30),
    });

    return NextResponse.json({
      ok: true,
      mode: "demo",
      subscription,
    });
  }

  const stripe = new Stripe(stripeKey);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: planId === "yearly" ? yearlyPriceId : monthlyPriceId,
        quantity: 1,
      },
    ],
    success_url: `${appConfig.appUrl}?billing=success`,
    cancel_url: `${appConfig.appUrl}?billing=cancelled`,
    customer_email: auth.record.user.email,
    metadata: {
      userId: auth.record.user.id,
      planId,
    },
    subscription_data: {
      trial_period_days: 7,
      metadata: {
        userId: auth.record.user.id,
        planId,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    mode: "stripe",
    checkoutUrl: session.url,
  });
}
