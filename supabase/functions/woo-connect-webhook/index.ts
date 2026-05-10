// Stripe Connect webhook for Woo bridge orders. Listens for
// checkout.session.completed events on connected accounts and idempotently
// marks the corresponding Woo order paid (in case the buyer closed the tab
// before the return page fired).
//
// Configure URL https://<project>.supabase.co/functions/v1/woo-connect-webhook
// under Stripe → Developers → Webhooks → Connect, event:
//   - checkout.session.completed
// Secret: STRIPE_CONNECT_WEBHOOK_SECRET (whsec_...)

import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import { signedTenantCall } from "../_shared/printonet-tenant.ts";

const STRIPE_SECRET = Deno.env.get("STRIPE_CONNECT_SECRET_KEY")!;

async function stripeGet(path: string, stripeAccount: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET}`,
      "Stripe-Account": stripeAccount,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

async function verify(body: string, sigHeader: string, secret: string) {
  let timestamp: string | undefined;
  const v1: string[] = [];
  for (const part of sigHeader.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v;
    if (k === "v1") v1.push(v);
  }
  if (!timestamp || v1.length === 0) throw new Error("invalid_signature_format");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("stale_timestamp");
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

async function completeFromSession(sessionId: string, accountId: string) {
  const session = await stripeGet(`/checkout/sessions/${encodeURIComponent(sessionId)}`, accountId);
  if (session.payment_status !== "paid") return { ok: false, reason: "not_paid" };
  const md = session.metadata || {};
  const wpSiteUrl = md.wp_site_url || md.woo_store_origin;
  const orderId = md.woo_order_id;
  const orderKey = md.woo_order_key;
  if (!wpSiteUrl || !orderId || !orderKey) return { ok: false, reason: "missing_metadata" };
  const callRes = await signedTenantCall(
    `/wp-json/printonet/v1/order/${encodeURIComponent(orderId)}/complete`,
    {
      method: "POST",
      baseUrlOverride: wpSiteUrl,
      body: {
        order_key: orderKey,
        transaction_id: session.payment_intent || session.id,
        amount_in_cents: session.amount_total,
        currency: session.currency,
        stripe_checkout_session_id: session.id,
        stripe_account_id: accountId,
      },
    },
  );
  return { ok: true, callRes };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const secret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");
  if (!secret) return new Response("server_misconfigured", { status: 500 });
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) return new Response("missing_signature", { status: 401 });
  try { await verify(body, sig, secret); } catch (e) {
    console.error("verify failed", e);
    return new Response("invalid_signature", { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(body); } catch { return new Response("bad_json", { status: 400 }); }

  const accountId = event.account;
  if (!accountId) {
    return new Response(JSON.stringify({ received: true, ignored: "no_account" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      if (session?.metadata?.woo_order_id) {
        const result = await completeFromSession(session.id, accountId);
        console.log("woo-connect-webhook complete", result);
      }
    } else {
      console.log("Unhandled event", event.type);
    }
  } catch (e) {
    console.error("handler error", e);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
