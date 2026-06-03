// Creates a Shopify recurring app subscription charge for the merchant.
// Returns a confirmationUrl the merchant must approve inside Shopify admin.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const PLAN_PRICES: Record<string, { name: string; amount: number }> = {
  customizer_monthly: { name: "Printonet Product Customizer", amount: 29.0 },
  starter_monthly: { name: "Printonet Starter", amount: 39.0 },
  growth_monthly: { name: "Printonet Grow", amount: 99.0 },
  pro_monthly: { name: "Printonet Pro", amount: 299.0 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData, error: userErr } = await anon.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const { priceId, returnUrl } = await req.json();
    const plan = PLAN_PRICES[priceId];
    if (!plan) return json({ error: "invalid_plan" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: integration } = await admin
      .from("store_integrations")
      .select("store_url, credentials")
      .eq("user_id", user.id)
      .eq("platform", "shopify")
      .maybeSingle();

    if (!integration?.store_url || !(integration.credentials as any)?.access_token) {
      return json({ error: "shopify_not_connected" }, 400);
    }

    const shopDomain = integration.store_url.replace(/^https?:\/\//, "");
    const accessToken = (integration.credentials as any).access_token as string;

    // Default to test charges; flip to "false" via env var when ready for live billing.
    const isTest = (Deno.env.get("SHOPIFY_BILLING_TEST") ?? "true") === "true";

    const callbackBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/shopify-billing-callback`;
    const returnTo = returnUrl || "https://platform.printonet.com/billing/return";
    const callbackUrl = `${callbackBase}?user_id=${encodeURIComponent(user.id)}&shop=${encodeURIComponent(shopDomain)}&plan=${encodeURIComponent(priceId)}&return_url=${encodeURIComponent(returnTo)}`;

    const mutation = `
      mutation appSubscriptionCreate(
        $name: String!,
        $returnUrl: URL!,
        $test: Boolean,
        $lineItems: [AppSubscriptionLineItemInput!]!
      ) {
        appSubscriptionCreate(
          name: $name,
          returnUrl: $returnUrl,
          test: $test,
          lineItems: $lineItems
        ) {
          userErrors { field message }
          confirmationUrl
          appSubscription { id status }
        }
      }
    `;

    const variables = {
      name: plan.name,
      returnUrl: callbackUrl,
      test: isTest,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: plan.amount, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    };

    const gqlRes = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    const gqlJson = await gqlRes.json();
    const result = gqlJson?.data?.appSubscriptionCreate;
    if (!gqlRes.ok || !result || result.userErrors?.length) {
      console.error("appSubscriptionCreate failed:", JSON.stringify(gqlJson));
      return json({
        error: "shopify_billing_failed",
        details: result?.userErrors || gqlJson?.errors || "Unknown Shopify error",
      }, 400);
    }

    return json({ confirmationUrl: result.confirmationUrl });
  } catch (e) {
    console.error("shopify-billing-create error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
