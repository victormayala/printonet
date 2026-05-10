// Stripe Connect webhook for Woo bridge orders. Listens for
// checkout.session.completed events on connected accounts and idempotently
// marks the corresponding Woo order paid (in case the buyer closed the tab
// before the return page fired).
//
// Configure this URL in your Stripe dashboard under
// Developers → Webhooks → "Connect" with event:
//   - checkout.session.completed
// Secret: STRIPE_CONNECT_WEBHOOK_SECRET (whsec_...)

import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import { completeWooCheckoutSession } from "../woo-checkout-complete/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verify(body: string, sigHeader: string, secret: string) {
  let timestamp: string | undefined;
  const v1: string[] = [];
  for (const part of sigHeader.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v;
    if (k === "v1") v1.push(v);
  }
  if (!timestamp || v1.length === 0) throw new Error("invalid_signature_format");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Error("stale_timestamp");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(sig)));
  if (!v1.includes(expected)) throw new Error("invalid_signature");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const secret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");
  if (!secret) {
    console.error("STRIPE_CONNECT_WEBHOOK_SECRET not configured");
    return new Response("server_misconfigured", { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) return new Response("missing_signature", { status: 401 });
  try {
    await verify(body, sig, secret);
  } catch (e) {
    console.error("verify failed", e);
    return new Response("invalid_signature", { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(body); } catch { return new Response("bad_json", { status: 400 }); }

  // For Connect webhooks Stripe sends `account` field with the connected account id.
  const stripeAccountId = event.account;
  if (!stripeAccountId) {
    console.warn("Event without account field, skipping", event.type);
    return new Response(JSON.stringify({ received: true, ignored: "no_account" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data?.object;
        if (session?.metadata?.woo_order_id) {
          const result = await completeWooCheckoutSession(session.id, stripeAccountId);
          console.log("woo-connect-webhook complete result", result);
        }
        break;
      }
      default:
        console.log("Unhandled event", event.type);
    }
  } catch (e) {
    console.error("handler error", e);
    // Still return 200 so Stripe doesn't retry indefinitely on terminal failures;
    // for transient ones we'd want 500, but we accept idempotent retries on next event.
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
