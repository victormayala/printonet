// Handles Stripe Connect webhook events (events from connected accounts via
// direct charges). Uses STRIPE_CONNECT_WEBHOOK_SECRET for signature
// verification. Mirrors order-creation logic from payments-webhook.
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CONNECT_SECRET = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET")!;
const STRIPE_CONNECT_SECRET_KEY = Deno.env.get("STRIPE_CONNECT_SECRET_KEY") || "";

async function verify(req: Request): Promise<{ type: string; account?: string; data: { object: any } }> {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1: string[] = [];
  for (const part of sig.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v;
    if (k === "v1") v1.push(v);
  }
  if (!timestamp || v1.length === 0) throw new Error("Invalid signature format");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Error("Webhook timestamp too old");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(CONNECT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));
  if (!v1.includes(expected)) throw new Error("Invalid webhook signature");
  return JSON.parse(body);
}

async function handleCheckoutCompleted(session: any, account: string | undefined, env: string) {
  console.log("[connect] checkout.session.completed", session.id, "account:", account);
  if (session.mode !== "payment") return;

  const md = session.metadata || {};
  const customizerSessionId = md.sessionId || md.customizer_session_id;
  if (!customizerSessionId) {
    console.log("[connect] no customizerSessionId metadata, skipping");
    return;
  }

  // Avoid duplicate inserts if the platform endpoint also delivered this.
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_checkout_id", session.id)
    .maybeSingle();
  if (existing) {
    console.log("[connect] order already exists for", session.id);
    return;
  }

  // Fetch the PaymentIntent on the connected account to read application_fee_amount.
  let applicationFeeAmount: number | null = null;
  if (session.payment_intent && account) {
    try {
      const piRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${session.payment_intent}`,
        {
          headers: {
            Authorization: `Bearer ${STRIPE_CONNECT_SECRET_KEY}`,
            "Stripe-Account": account,
          },
        },
      );
      const pi = await piRes.json();
      if (typeof pi?.application_fee_amount === "number") {
        applicationFeeAmount = pi.application_fee_amount;
      }
    } catch (e) {
      console.error("[connect] PI fetch failed:", e);
    }
  }

  // sessionId metadata may be a CSV (cart of multiple customizer sessions).
  const sessionIds = String(customizerSessionId).split(",").map((s) => s.trim()).filter(Boolean);
  for (const sid of sessionIds) {
    const { error } = await supabase.from("orders").insert({
      session_id: sid,
      stripe_checkout_id: session.id,
      stripe_payment_intent: session.payment_intent,
      customer_email: session.customer_details?.email || session.customer_email,
      amount_total: session.amount_total,
      currency: session.currency,
      status: "paid",
      environment: env,
      store_id: md.printonet_store_id || null,
      stripe_account_id: account || null,
      application_fee_amount: applicationFeeAmount,
    });
    if (error) console.error("[connect] order insert failed for", sid, error);

    await supabase
      .from("customizer_sessions")
      .update({ status: "ordered" })
      .eq("id", sid);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const event = await verify(req);
    const env = new URL(req.url).searchParams.get("env") || "sandbox";
    console.log("[connect] event:", event.type, "account:", event.account);
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(event.data.object, event.account, env);
        break;
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
        console.log("[connect]", event.type, event.data.object.id);
        break;
      default:
        console.log("[connect] unhandled:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[connect] webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
