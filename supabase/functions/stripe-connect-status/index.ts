// Retrieves the latest status of a corporate store's connected Stripe account
// and persists the flags. Returns { connected, charges_enabled, payouts_enabled,
// details_submitted, requirements_due }.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const STRIPE_SECRET = Deno.env.get("STRIPE_CONNECT_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { storeId } = await req.json();
    if (!storeId) {
      return new Response(JSON.stringify({ error: "missing_storeId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: store, error: storeErr } = await admin
      .from("corporate_stores")
      .select("id, user_id, stripe_account_id")
      .eq("id", storeId)
      .single();

    if (storeErr || !store) {
      return new Response(JSON.stringify({ error: "store_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (store.user_id !== userId) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!store.stripe_account_id) {
      return new Response(
        JSON.stringify({ connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch(`https://api.stripe.com/v1/accounts/${store.stripe_account_id}`, {
      headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
    });
    const acct = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: acct?.error?.message || "stripe_error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const charges_enabled = !!acct.charges_enabled;
    const payouts_enabled = !!acct.payouts_enabled;
    const details_submitted = !!acct.details_submitted;
    const fullyConnected = charges_enabled && details_submitted;

    await admin
      .from("corporate_stores")
      .update({
        stripe_charges_enabled: charges_enabled,
        stripe_payouts_enabled: payouts_enabled,
        stripe_details_submitted: details_submitted,
        ...(fullyConnected ? { stripe_connected_at: new Date().toISOString() } : {}),
      })
      .eq("id", storeId);

    return new Response(
      JSON.stringify({
        connected: fullyConnected,
        charges_enabled,
        payouts_enabled,
        details_submitted,
        requirements_due: acct.requirements?.currently_due ?? [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("stripe-connect-status error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
