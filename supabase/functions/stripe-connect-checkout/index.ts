// Creates a Stripe Embedded Checkout Session ON BEHALF of a corporate store's
// connected Express account (direct charge model). Funds settle directly on
// the merchant; Printonet never holds funds.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET = Deno.env.get("STRIPE_CONNECT_SECRET_KEY")!;
const STRIPE_PUBLISHABLE = Deno.env.get("STRIPE_CONNECT_PUBLISHABLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function stripeRequest(
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      storeId,
      amountInCents,
      quantity,
      productName,
      sessionId,
      customerEmail,
      returnUrl,
    } = await req.json();

    if (!storeId) {
      return new Response(JSON.stringify({ error: "missing_storeId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!amountInCents || typeof amountInCents !== "number" || amountInCents < 50) {
      return new Response(JSON.stringify({ error: "amount_must_be_at_least_50_cents" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: store, error: storeErr } = await admin
      .from("corporate_stores")
      .select("id, name, stripe_account_id, stripe_charges_enabled, platform_fee_bps")
      .eq("id", storeId)
      .single();
    if (storeErr || !store) {
      return new Response(JSON.stringify({ error: "store_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!store.stripe_account_id || !store.stripe_charges_enabled) {
      return new Response(
        JSON.stringify({ error: "store_payments_not_ready" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const params: Record<string, string> = {
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": productName || store.name || "Custom Product",
      "line_items[0][price_data][unit_amount]": String(amountInCents),
      "line_items[0][quantity]": String(quantity || 1),
      mode: "payment",
      ui_mode: "embedded",
      return_url:
        returnUrl ||
        "https://platform.printonet.com/checkout/return?session_id={CHECKOUT_SESSION_ID}",
    };
    if (customerEmail) params.customer_email = customerEmail;
    if (sessionId) {
      params["metadata[customizer_session_id]"] = String(sessionId);
      params["payment_intent_data[metadata][customizer_session_id]"] = String(sessionId);
    }
    params["metadata[printonet_store_id]"] = store.id;
    params["payment_intent_data[metadata][printonet_store_id]"] = store.id;

    // Platform fee (direct charge model): a slice of the merchant's charge is
    // automatically routed to Printonet's platform Stripe account.
    const qty = Math.max(1, Number(quantity) || 1);
    const bps = Math.max(0, Number((store as any).platform_fee_bps ?? 250));
    const grossCents = amountInCents * qty;
    const feeCents = Math.floor((grossCents * bps) / 10000);
    if (feeCents > 0 && feeCents < grossCents) {
      params["payment_intent_data[application_fee_amount]"] = String(feeCents);
    }
    params["metadata[platform_fee_bps]"] = String(bps);
    params["payment_intent_data[metadata][platform_fee_bps]"] = String(bps);

    // Direct charge: pass Stripe-Account header so the session is created on
    // the connected account. Funds settle on the merchant.
    const session = await stripeRequest(
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
    console.error("stripe-connect-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
