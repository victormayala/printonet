// Called by the MP return page (and idempotently by a webhook) after the
// shopper completes Stripe Checkout for a Woo order. Verifies the Checkout
// Session was paid on the connected account, then calls the signed Printonet
// HMAC endpoint on the tenant WP store to mark the Woo order paid.
//
// Inputs (POST JSON):
//   stripe_checkout_session_id: string (required)
//   stripe_account_id:          string (required)

import { signedTenantCall } from "../_shared/printonet-tenant.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET = Deno.env.get("STRIPE_CONNECT_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function bad(status: number, error: string, detail?: unknown) {
  return new Response(JSON.stringify({ error, detail }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function completeWooCheckoutSession(
  sessionId: string,
  stripeAccountId: string,
): Promise<{ ok: true; success_url: string } | { ok: false; reason: string; detail?: unknown }> {
  const session = await stripeGet(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    stripeAccountId,
  );
  if (session.payment_status !== "paid") {
    return { ok: false, reason: "not_paid", detail: { payment_status: session.payment_status } };
  }
  const md = session.metadata || {};
  const wpSiteUrl = md.wp_site_url || md.woo_store_origin;
  const orderId = md.woo_order_id;
  const orderKey = md.woo_order_key;
  const successUrl = md.woo_success_url;
  if (!wpSiteUrl || !orderId || !orderKey) {
    return { ok: false, reason: "missing_metadata", detail: md };
  }

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
        stripe_account_id: stripeAccountId,
      },
    },
  );
  if ("error" in callRes) {
    return { ok: false, reason: "tenant_call_failed", detail: callRes };
  }
  if (!callRes.ok) {
    return {
      ok: false,
      reason: "tenant_complete_rejected",
      detail: { status: callRes.status, response: callRes.response },
    };
  }

  // Best-effort: mirror the paid Woo order into printonet_woo_order_files so
  // it shows up in the Printonet dashboard "Orders" tab without depending on
  // the tenant WP plugin pushing a webhook.
  try {
    const tenantSlug = String(md.tenant_slug || "").trim();
    if (tenantSlug) {
      const orderRes = await signedTenantCall(
        `/wp-json/printonet/v1/order/${encodeURIComponent(orderId)}?order_key=${encodeURIComponent(orderKey)}`,
        { method: "GET", baseUrlOverride: wpSiteUrl },
      );
      const orderData =
        "ok" in orderRes && orderRes.ok && orderRes.response && typeof orderRes.response === "object"
          ? (orderRes.response as Record<string, unknown>)
          : {};

      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false },
      });

      const lineItems = Array.isArray((orderData as any).line_items)
        ? (orderData as any).line_items
        : [];

      const row = {
        tenant_slug: tenantSlug,
        store_url: String(wpSiteUrl).replace(/\/+$/, ""),
        order_id: Number(orderId),
        order_number: (orderData as any).order_number
          ? String((orderData as any).order_number)
          : String(orderId),
        order_status: String((orderData as any).status || "processing"),
        currency: session.currency ? String(session.currency).toUpperCase() : null,
        date_paid: new Date().toISOString(),
        line_items: lineItems,
        payload: {
          source: "woo-checkout-complete",
          stripe_checkout_session_id: session.id,
          stripe_account_id: stripeAccountId,
          amount_total: session.amount_total,
          customer_email: session.customer_details?.email || (orderData as any).customer_email || null,
          tenant_order: orderData,
        },
        updated_at: new Date().toISOString(),
      };

      const { error: upsertErr } = await supabase
        .from("printonet_woo_order_files")
        .upsert(row, { onConflict: "tenant_slug,store_url,order_id" });
      if (upsertErr) {
        console.error("printonet_woo_order_files upsert failed", upsertErr);
      }
    }
  } catch (mirrorErr) {
    console.error("woo-checkout-complete mirror error", mirrorErr);
  }

  return { ok: true, success_url: successUrl || "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "method_not_allowed");

  try {
    const { stripe_checkout_session_id, stripe_account_id } = await req.json();
    if (!stripe_checkout_session_id || !stripe_account_id) {
      return bad(400, "missing_required_fields");
    }
    const result = await completeWooCheckoutSession(
      stripe_checkout_session_id,
      stripe_account_id,
    );
    if (!result.ok) {
      const status = result.reason === "not_paid" ? 402 : 500;
      return bad(status, result.reason, result.detail);
    }
    return new Response(
      JSON.stringify({ ok: true, success_url: result.success_url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("woo-checkout-complete error", e);
    return bad(500, "internal_error", (e as Error).message);
  }
});
