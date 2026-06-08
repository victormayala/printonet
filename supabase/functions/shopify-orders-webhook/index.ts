// Receives Shopify orders/paid (and orders/create) webhooks, verifies HMAC,
// and inserts a row into the orders + order_items tables so the Printonet
// Orders tab surfaces print files and design info for customized products.
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { ingestShopifyOrder } from "../_shared/shopify-orders.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain",
};

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  const hmac = req.headers.get("X-Shopify-Hmac-Sha256");
  const topic = req.headers.get("X-Shopify-Topic") || "";
  const shopDomain = req.headers.get("X-Shopify-Shop-Domain") || "";

  if (!(await verifyHmac(rawBody, hmac))) {
    console.error("Invalid Shopify orders webhook HMAC");
    return new Response("Invalid signature", { status: 401 });
  }

  // We care about paid orders. Accept orders/create too in case the merchant
  // captures payment up-front (paid_at set on create) — ingestion is idempotent.
  if (!topic.startsWith("orders/")) {
    return new Response(JSON.stringify({ received: true, ignored: topic }), { status: 200 });
  }

  let order: any;
  try { order = JSON.parse(rawBody); } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Only ingest if effectively paid.
  const fs = String(order.financial_status || "").toLowerCase();
  const isPaid = fs === "paid" || fs === "partially_paid" || !!order.paid_at;
  if (topic !== "orders/paid" && !isPaid) {
    return new Response(JSON.stringify({ received: true, skipped: "not paid yet" }), { status: 200 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const result = await ingestShopifyOrder(admin, shopDomain, order);
    return new Response(JSON.stringify({ received: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Ingest failed:", err);
    return new Response(JSON.stringify({ error: err?.message || "ingest failed" }), { status: 500 });
  }
});
