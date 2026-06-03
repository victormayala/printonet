// Shopify redirects merchants here with ?charge_id=... after approving (or declining)
// an app subscription. We verify the charge is ACTIVE via Admin API, upsert the
// subscription row, then redirect back to the platform.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const chargeId = url.searchParams.get("charge_id");
    const userId = url.searchParams.get("user_id");
    const shopDomain = url.searchParams.get("shop");
    const plan = url.searchParams.get("plan");
    const returnUrl = url.searchParams.get("return_url") ||
      "https://platform.printonet.com/billing/return";

    if (!chargeId || !userId || !shopDomain || !plan) {
      return new Response("Missing required parameters", { status: 400 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: integration } = await admin
      .from("store_integrations")
      .select("credentials")
      .eq("user_id", userId)
      .eq("platform", "shopify")
      .maybeSingle();

    const accessToken = (integration?.credentials as any)?.access_token as
      | string
      | undefined;
    if (!accessToken) return new Response("Shopify integration not found", { status: 400 });

    // Look up the subscription by GID. The numeric charge_id maps to:
    //   gid://shopify/AppSubscription/<charge_id>
    const gid = `gid://shopify/AppSubscription/${chargeId}`;
    const query = `
      query($id: ID!) {
        node(id: $id) {
          ... on AppSubscription {
            id
            name
            status
            test
            currentPeriodEnd
            createdAt
          }
        }
      }
    `;

    const gqlRes = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { id: gid } }),
    });
    const gqlJson = await gqlRes.json();
    const sub = gqlJson?.data?.node;

    if (!sub || !sub.status) {
      return redirectWith(returnUrl, { shopify_billing: "error" });
    }

    // Map Shopify status -> our status semantics.
    // Shopify: ACTIVE | CANCELLED | DECLINED | EXPIRED | FROZEN | PENDING | ACCEPTED
    const statusMap: Record<string, string> = {
      ACTIVE: "active",
      ACCEPTED: "active",
      PENDING: "incomplete",
      DECLINED: "canceled",
      CANCELLED: "canceled",
      EXPIRED: "canceled",
      FROZEN: "past_due",
    };
    const mappedStatus = statusMap[sub.status] || sub.status.toLowerCase();

    // Live charges in Shopify are real billing; test charges are sandbox.
    const env = sub.test ? "sandbox" : "live";

    await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        source: "shopify",
        shopify_charge_id: chargeId,
        shopify_shop_domain: shopDomain,
        stripe_subscription_id: `shopify_${chargeId}`,
        stripe_customer_id: `shopify_${shopDomain}`,
        product_id: plan,
        price_id: plan,
        status: mappedStatus,
        current_period_end: sub.currentPeriodEnd ?? null,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shopify_charge_id" },
    );

    return redirectWith(returnUrl, {
      shopify_billing: mappedStatus === "active" ? "active" : "pending",
      charge_id: chargeId,
    });
  } catch (err: any) {
    console.error("shopify-billing-callback error:", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
});

function redirectWith(base: string, params: Record<string, string>): Response {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${u.toString()}"></head><body>Redirecting…</body></html>`;
  return new Response(html, {
    status: 302,
    headers: { Location: u.toString(), "Content-Type": "text/html; charset=utf-8" },
  });
}
