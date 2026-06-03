// Receives Shopify app_subscriptions/update webhooks so we keep our local
// subscription row in sync when merchants cancel, renew, or change plans
// from inside Shopify admin.
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

async function verifyHmac(rawBody: string, hmacHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get("SHOPIFY_API_SECRET");
  if (!secret || !hmacHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = encodeBase64(new Uint8Array(sig));
  return expected === hmacHeader;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  const hmac = req.headers.get("X-Shopify-Hmac-Sha256");
  const topic = req.headers.get("X-Shopify-Topic") || "";
  const shopDomain = req.headers.get("X-Shopify-Shop-Domain") || "";

  if (!(await verifyHmac(rawBody, hmac))) {
    console.error("Invalid Shopify webhook HMAC");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (topic !== "app_subscriptions/update") {
    return new Response(JSON.stringify({ received: true, ignored: topic }), { status: 200 });
  }

  const appSub = payload.app_subscription || payload;
  const adminGraphqlId: string | undefined = appSub.admin_graphql_api_id;
  const chargeId = adminGraphqlId
    ? adminGraphqlId.split("/").pop()
    : String(appSub.id ?? "");
  if (!chargeId) return new Response("No charge id", { status: 400 });

  const statusMap: Record<string, string> = {
    ACTIVE: "active",
    ACCEPTED: "active",
    PENDING: "incomplete",
    DECLINED: "canceled",
    CANCELLED: "canceled",
    EXPIRED: "canceled",
    FROZEN: "past_due",
  };
  const rawStatus = String(appSub.status || "").toUpperCase();
  const mappedStatus = statusMap[rawStatus] || rawStatus.toLowerCase();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await admin
    .from("subscriptions")
    .update({
      status: mappedStatus,
      current_period_end: appSub.current_period_end ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("shopify_charge_id", String(chargeId))
    .eq("shopify_shop_domain", shopDomain);

  if (error) console.error("subscription update failed:", error);

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
