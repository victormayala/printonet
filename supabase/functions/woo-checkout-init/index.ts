// Receives a redirect from the Printonet WP MU plugin (Printonet_MP_Stripe_Checkout)
// after the shopper clicks "Place order" on a tenant Woo store. Resolves the
// tenant's connected Stripe Express account, fetches the Woo order total via
// the signed Printonet HMAC API, and creates a Stripe Embedded Checkout Session
// on the connected account (Direct Charge model).
//
// Inputs (POST JSON):
//   tenant_slug:  string  (required)
//   order_id:     number  (required)
//   order_key:    string  (required, WP order key, e.g. "wc_order_XXXX")
//   store_origin: string  (required, https://tenant.example.com)
//   success_url:  string  (required, Woo thank-you URL)
//   cancel_url:   string  (required, Woo checkout URL)
//
// Output:
//   { clientSecret, publishableKey, accountId } on success
//   { redirect: success_url } if order already paid

import { createClient } from "npm:@supabase/supabase-js@2";
import { signedTenantCall } from "../_shared/printonet-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET = Deno.env.get("STRIPE_CONNECT_SECRET_KEY")!;
const STRIPE_PUBLISHABLE = Deno.env.get("STRIPE_CONNECT_PUBLISHABLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function stripePost(
  path: string,
  params: Record<string, string>,
  stripeAccount?: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (stripeAccount) headers["Stripe-Account"] = stripeAccount;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(params).toString(),
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return bad(405, "method_not_allowed");

  try {
    const {
      tenant_slug,
      order_id,
      order_key,
      store_origin,
      success_url,
      cancel_url,
    } = await req.json();

    if (!tenant_slug || !order_id || !order_key || !store_origin || !success_url) {
      return bad(400, "missing_required_fields");
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // 1. Resolve store by tenant_slug.
    const { data: store, error: storeErr } = await admin
      .from("corporate_stores")
      .select(
        "id, name, tenant_slug, stripe_account_id, stripe_charges_enabled, wp_site_url",
      )
      .eq("tenant_slug", tenant_slug)
      .maybeSingle();
    if (storeErr) return bad(500, "store_lookup_failed", storeErr.message);
    if (!store) return bad(404, "store_not_found");
    if (!store.stripe_account_id || !store.stripe_charges_enabled) {
      return bad(409, "store_payments_not_ready");
    }

    // 2. Fetch Woo order details from the tenant via the signed HMAC endpoint.
    //    Contract documented in docs/woo-mp-checkout-contract.md.
    const baseUrl = store.wp_site_url || store_origin;
    const orderRes = await signedTenantCall(
      `/wp-json/printonet/v1/order/${encodeURIComponent(
        String(order_id),
      )}?order_key=${encodeURIComponent(order_key)}`,
      { method: "GET", baseUrlOverride: baseUrl },
    );
    if ("error" in orderRes) {
      return bad(502, "tenant_order_fetch_failed", orderRes);
    }
    if (!orderRes.ok) {
      return bad(502, "tenant_order_fetch_failed", { status: orderRes.status, response: orderRes.response });
    }
    const order = orderRes.response as {
      order_id: number;
      order_key: string;
      status: string;
      currency: string;
      total_in_cents: number;
      customer_email?: string;
      line_items?: Array<{ name: string; quantity: number; price_in_cents: number }>;
    };

    // Already paid → tell client to redirect straight to Woo's thank-you page.
    if (
      order.status &&
      ["processing", "completed", "on-hold"].includes(order.status)
    ) {
      return new Response(JSON.stringify({ redirect: success_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.total_in_cents || order.total_in_cents < 50) {
      return bad(400, "amount_too_small", { total_in_cents: order.total_in_cents });
    }

    const currency = (order.currency || "usd").toLowerCase();
    // IMPORTANT: charge Woo's authoritative `total_in_cents` (includes shipping,
    // taxes, fees, discounts). If we instead summed `line_items[].price_in_cents`,
    // Stripe's amount_total would diverge from what the tenant WP plugin expects
    // in /complete and the order would be rejected with 422 "Amount or currency
    // does not match order" — leaving the payment stuck "pending" in both
    // Stripe and Woo. Use a single aggregate line so the totals always match.
    const itemSummary = Array.isArray(order.line_items) && order.line_items.length > 0
      ? order.line_items
          .map((it) => `${it.quantity}× ${it.name}`)
          .join(", ")
          .slice(0, 240)
      : `Order #${order_id}`;
    const items = [{
      name: `Order #${order_id}${itemSummary ? ` — ${itemSummary}` : ""}`.slice(0, 250),
      quantity: 1,
      price_in_cents: order.total_in_cents,
    }];

    // 3. Build Stripe Checkout Session on the connected account.
    const params: Record<string, string> = {
      mode: "payment",
      ui_mode: "embedded_page",
    };

    // Return URL points back at the MP so we can verify + complete the Woo order.
    const platformOrigin = new URL(req.url).origin.replace(
      /\.supabase\.co$/,
      "",
    );
    const projectId = Deno.env.get("VITE_SUPABASE_PROJECT_ID") || "";
    // The Stripe placeholder is substituted server-side by Stripe.
    const returnUrl = `${req.headers.get("origin") || "https://platform.printonet.com"}/pay/woo/return?session_id={CHECKOUT_SESSION_ID}&account_id=${encodeURIComponent(
      store.stripe_account_id,
    )}`;
    params["return_url"] = returnUrl;

    items.forEach((it, i) => {
      params[`line_items[${i}][price_data][currency]`] = currency;
      params[`line_items[${i}][price_data][product_data][name]`] = String(
        it.name || `Item ${i + 1}`,
      ).slice(0, 250);
      params[`line_items[${i}][price_data][unit_amount]`] = String(
        Math.max(1, Math.round(it.price_in_cents)),
      );
      params[`line_items[${i}][quantity]`] = String(Math.max(1, it.quantity || 1));
    });

    if (order.customer_email) params["customer_email"] = order.customer_email;

    // Metadata for completion / webhook.
    const md: Record<string, string> = {
      printonet_store_id: store.id,
      tenant_slug,
      woo_order_id: String(order_id),
      woo_order_key: order_key,
      woo_store_origin: store_origin,
      woo_success_url: success_url,
      woo_cancel_url: cancel_url || "",
      wp_site_url: baseUrl,
    };
    for (const [k, v] of Object.entries(md)) {
      params[`metadata[${k}]`] = v;
      params[`payment_intent_data[metadata][${k}]`] = v;
    }

    const session = await stripePost(
      "/checkout/sessions",
      params,
      store.stripe_account_id,
    );

    return new Response(
      JSON.stringify({
        clientSecret: session.client_secret,
        publishableKey: STRIPE_PUBLISHABLE,
        accountId: store.stripe_account_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("woo-checkout-init error", e);
    return bad(500, "internal_error", (e as Error).message);
  }
});
