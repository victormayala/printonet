// One-click setup for Shopify order ingestion:
//   1. Subscribes the shop to orders/paid (and orders/create) webhook topics
//      pointing at shopify-orders-webhook.
//   2. Backfills the last 30 days of paid orders so any orders placed before
//      the webhook was registered also show up in the Orders tab.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getValidShopifyToken } from "../_shared/shopify-token.ts";
import { ingestShopifyOrder } from "../shopify-orders-webhook/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const API_VERSION = "2025-01";

function shopFromUrl(storeUrl: string): string {
  return String(storeUrl || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

async function ensureWebhook(
  shop: string,
  accessToken: string,
  topic: string,
  address: string,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  // List existing webhooks for this topic.
  const listRes = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/webhooks.json?topic=${encodeURIComponent(topic)}`,
    { headers: { "X-Shopify-Access-Token": accessToken } },
  );
  if (listRes.ok) {
    const data = await listRes.json();
    const match = (data.webhooks || []).find((w: any) => w.address === address);
    if (match) return { ok: true, id: match.id };
  }

  const createRes = await fetch(`https://${shop}/admin/api/${API_VERSION}/webhooks.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    return { ok: false, error: `${topic}: ${errText}` };
  }
  const created = await createRes.json();
  return { ok: true, id: created.webhook?.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Missing Authorization" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) return json(401, { error: "Invalid token" });

  let body: { storeId?: string };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const storeId = body.storeId;
  if (!storeId) return json(400, { error: "storeId is required" });

  const { data: store } = await admin
    .from("corporate_stores")
    .select("id, user_id, store_type")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) return json(404, { error: "Store not found" });
  if (store.user_id !== userRes.user.id) return json(403, { error: "Not your store" });
  if (store.store_type !== "shopify") return json(400, { error: "Store is not Shopify" });

  let storeUrl: string, accessToken: string;
  try {
    const tok = await getValidShopifyToken(admin, store.user_id);
    storeUrl = tok.store_url;
    accessToken = tok.access_token;
  } catch (e: any) {
    return json(400, { error: e?.message || "No Shopify token" });
  }

  const shop = shopFromUrl(storeUrl);
  const webhookAddress = `${SUPABASE_URL}/functions/v1/shopify-orders-webhook`;

  const reg: Record<string, unknown> = {};
  for (const topic of ["orders/paid", "orders/create"]) {
    reg[topic] = await ensureWebhook(shop, accessToken, topic, webhookAddress);
  }

  // Backfill last 30 days of paid orders.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let backfilled = 0;
  let skipped = 0;
  let pageInfo: string | null = null;
  let firstPageUrl: string | null =
    `https://${shop}/admin/api/${API_VERSION}/orders.json?status=any&financial_status=paid&created_at_min=${encodeURIComponent(since)}&limit=50`;

  while (firstPageUrl) {
    const ordRes = await fetch(firstPageUrl, {
      headers: { "X-Shopify-Access-Token": accessToken },
    });
    if (!ordRes.ok) {
      console.error("Backfill list failed:", await ordRes.text());
      break;
    }
    const data = await ordRes.json();
    const orders = Array.isArray(data.orders) ? data.orders : [];
    for (const o of orders) {
      const res = await ingestShopifyOrder(admin, shop, o);
      if (res.inserted) backfilled++; else skipped++;
    }

    // Cursor-based pagination via Link header
    const link = ordRes.headers.get("Link") || ordRes.headers.get("link") || "";
    const m = link.match(/<([^>]+)>;\s*rel="next"/i);
    firstPageUrl = m ? m[1] : null;
    if (pageInfo === firstPageUrl) break; // safety
    pageInfo = firstPageUrl;
  }

  return json(200, {
    ok: true,
    webhook_address: webhookAddress,
    registrations: reg,
    backfill: { backfilled, skipped, since },
  });
});
