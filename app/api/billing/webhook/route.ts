import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { store } from "@/lib/store";
import { PlanId, SubscriptionStatus } from "@/lib/types";

function mapStripeStatus(status: string): SubscriptionStatus {
  if (status === "trialing") {
    return "trialing";
  }
  if (status === "active") {
    return "active";
  }
  if (status === "past_due") {
    return "past_due";
  }
  if (status === "canceled" || status === "unpaid") {
    return "canceled";
  }
  return "inactive";
}

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const stripe = new Stripe(stripeKey);
  const signature = (await headers()).get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();
  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    const planId = (session.metadata?.planId as PlanId | undefined) || "monthly";
    if (userId) {
      await store.upsertSubscription(userId, {
        planId,
        provider: "stripe",
        status: "trialing",
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        trialEndsAt: null,
        currentPeriodEnd: null,
      });
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata.userId;
    const planId = (subscription.metadata.planId as PlanId | undefined) || "monthly";
    if (userId) {
      await store.upsertSubscription(userId, {
        planId,
        provider: "stripe",
        status: mapStripeStatus(subscription.status),
        stripeCustomerId:
          typeof subscription.customer === "string" ? subscription.customer : null,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        trialEndsAt: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
