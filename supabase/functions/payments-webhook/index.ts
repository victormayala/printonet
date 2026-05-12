import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const PLAN_FEE_BPS: Record<string, number> = {
  starter_monthly: 250,
  growth_monthly: 150,
  pro_monthly: 50,
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Received event:", event.type, "env:", env);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, env);
        break;
      case "transaction.completed":
        console.log("Transaction completed:", event.data.object.id);
        break;
      case "transaction.payment_failed":
        console.log("Payment failed:", event.data.object.id);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

function planFromPrice(price: any): string | null {
  return price?.lookup_key
    ?? price?.metadata?.lovable_external_id
    ?? null;
}

async function handleSubscriptionUpsert(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata", subscription.id);
    return;
  }
  const items: any[] = subscription.items?.data ?? [];

  // Identify the plan line item vs the extra-store add-on
  let planItem: any = null;
  let extraStoreQty = 0;
  for (const it of items) {
    const key = planFromPrice(it.price);
    if (key === "extra_store_monthly") {
      extraStoreQty = it.quantity ?? 0;
    } else if (key && PLAN_FEE_BPS[key] !== undefined) {
      planItem = it;
    }
  }
  if (!planItem) planItem = items[0];

  const priceId = planFromPrice(planItem?.price) ?? "unknown";
  const productId = typeof planItem?.price?.product === "string"
    ? planItem.price.product
    : planItem?.price?.product?.id ?? null;

  const periodStart = planItem?.current_period_start ?? subscription.current_period_start;
  const periodEnd = planItem?.current_period_end ?? subscription.current_period_end;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      extra_store_quantity: extraStoreQty,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" }
  );
  if (error) console.error("subscriptions upsert failed:", error);

  // Apply fee + restore stores when active
  const isActive = ["active", "trialing", "past_due"].includes(subscription.status);
  if (isActive) {
    const bps = PLAN_FEE_BPS[priceId] ?? 250;
    const { error: feeErr } = await supabase.rpc(
      "printonet_apply_plan_fee_to_user_stores",
      { p_user_id: userId, p_bps: bps },
    );
    if (feeErr) console.error("apply_plan_fee failed:", feeErr);
    const { error: restoreErr } = await supabase.rpc(
      "printonet_set_user_stores_status",
      { p_user_id: userId, p_status: "active" },
    );
    if (restoreErr) console.error("restore stores failed:", restoreErr);
  } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
    const { error: pauseErr } = await supabase.rpc(
      "printonet_set_user_stores_status",
      { p_user_id: userId, p_status: "paused" },
    );
    if (pauseErr) console.error("pause stores failed:", pauseErr);
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  await supabase
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
  if (userId) {
    await supabase.rpc("printonet_set_user_stores_status", {
      p_user_id: userId, p_status: "paused",
    });
  }
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  console.log("Checkout completed:", session.id, "mode:", session.mode);

  // Subscription checkouts are handled by customer.subscription.created.
  if (session.mode === "subscription") return;

  const md = session.metadata || {};
  const customizerSessionId = md.sessionId || md.customizer_session_id;
  if (!customizerSessionId) {
    console.log("No sessionId in metadata, skipping order creation");
    return;
  }

  // Pull application fee from the underlying PaymentIntent (Connect direct charges).
  let applicationFeeAmount: number | null = null;
  if (session.payment_intent && md.printonet_store_id && session.account) {
    try {
      const piRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${session.payment_intent}`,
        {
          headers: {
            Authorization: `Bearer ${Deno.env.get("STRIPE_CONNECT_SECRET_KEY") || ""}`,
            "Stripe-Account": session.account,
          },
        },
      );
      const pi = await piRes.json();
      if (typeof pi?.application_fee_amount === "number") {
        applicationFeeAmount = pi.application_fee_amount;
      }
    } catch (e) {
      console.error("Failed to fetch PI for fee:", e);
    }
  }

  const { error } = await supabase.from("orders").insert({
    session_id: customizerSessionId,
    stripe_checkout_id: session.id,
    stripe_payment_intent: session.payment_intent,
    customer_email: session.customer_details?.email || session.customer_email,
    amount_total: session.amount_total,
    currency: session.currency,
    status: "paid",
    environment: env,
    store_id: md.printonet_store_id || null,
    stripe_account_id: session.account || null,
    application_fee_amount: applicationFeeAmount,
  });

  if (error) console.error("Failed to create order:", error);

  await supabase
    .from("customizer_sessions")
    .update({ status: "ordered" })
    .eq("id", customizerSessionId);
}
