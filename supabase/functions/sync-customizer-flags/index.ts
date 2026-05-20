// Sync customizer flags for a single corporate store to the hosted storefront.
//
// Sends a full HMAC-signed snapshot of all customizable products for the given
// store to:
//   POST `${PRINTONET_STOREFRONT_PUBLIC_URL}/api/public/${tenant_slug}/customizer-flags`
//
// Headers:
//   x-platform-timestamp: <unix seconds>
//   x-platform-signature: hex(hmac_sha256(`${timestamp}.${rawBody}`, PRINTONET_PLATFORM_HMAC_SECRET))
//
// Body:
//   { items: [{ sku, name, customizer_url }, ...] }
//
// Auth: requires a valid Supabase user JWT (the calling owner). We validate
// ownership of the store before publishing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const HMAC_SECRET = Deno.env.get("PRINTONET_PLATFORM_HMAC_SECRET");
  const STOREFRONT_URL =
    Deno.env.get("PRINTONET_STOREFRONT_PUBLIC_URL") ||
    Deno.env.get("PRINTONET_STOREFRONT_URL") ||
    Deno.env.get("PRINTONET_TENANT_BASE_URL");
  // Customizer Studio deployed URL (this app). The storefront iframes this URL
  // verbatim, so it MUST be the customizer host, not the storefront host.
  const CUSTOMIZER_STUDIO_URL =
    Deno.env.get("CUSTOMIZER_STUDIO_PUBLIC_URL") ||
    "https://customizerstudio.com";

  if (!HMAC_SECRET) return json(500, { error: "PRINTONET_PLATFORM_HMAC_SECRET is not configured" });
  if (!STOREFRONT_URL) return json(500, { error: "Storefront base URL secret is not configured" });

  // Auth: validate the caller
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Missing Authorization" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) return json(401, { error: "Invalid token" });
  const userId = userRes.user.id;

  let body: { storeId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const storeId = body.storeId;
  if (!storeId || typeof storeId !== "string") {
    return json(400, { error: "storeId is required" });
  }

  // Load store and verify ownership
  const { data: store, error: sErr } = await admin
    .from("corporate_stores")
    .select("id, user_id, tenant_slug, status")
    .eq("id", storeId)
    .maybeSingle();
  if (sErr || !store) return json(404, { error: "Store not found" });
  if (store.user_id !== userId) return json(403, { error: "Not your store" });
  if (!store.tenant_slug) return json(400, { error: "Store has no tenant_slug" });

  // Load customizable links for this store
  const { data: links, error: lErr } = await admin
    .from("corporate_store_products")
    .select("product_id, customizable, is_active")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .eq("customizable", true);
  if (lErr) return json(500, { error: `Failed to read links: ${lErr.message}` });

  const productIds = (links ?? []).map((l) => l.product_id);
  let products: Array<{ id: string; name: string }> = [];
  if (productIds.length > 0) {
    const { data: prods, error: pErr } = await admin
      .from("inventory_products")
      .select("id, name")
      .in("id", productIds);
    if (pErr) return json(500, { error: `Failed to read products: ${pErr.message}` });
    products = prods ?? [];
  }

  const storefrontBase = STOREFRONT_URL.replace(/\/+$/, "");
  const customizerBase = CUSTOMIZER_STUDIO_URL.replace(/\/+$/, "");
  const items = products.map((p) => ({
    sku: p.id, // we don't store a separate SKU; product UUID is the stable id
    name: p.name,
    // Must point at the Customizer Studio app (this project), not the storefront.
    // The storefront iframes this URL verbatim. /s/:tenant/customize/:productId
    // creates a session and redirects to /embed/:sessionId with store branding.
    customizer_url: `${customizerBase}/s/${store.tenant_slug}/customize/${p.id}`,
  }));

  const payload = JSON.stringify({ items });
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = await hmacHex(HMAC_SECRET, `${ts}.${payload}`);
  const endpoint = `${storefrontBase}/api/public/${store.tenant_slug}/customizer-flags`;

  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Printonet-Timestamp": ts,
        "X-Printonet-Signature": signature,
      },
      body: payload,
    });
  } catch (e) {
    return json(502, {
      error: "Storefront unreachable",
      detail: e instanceof Error ? e.message : String(e),
      endpoint,
    });
  }

  const respText = await resp.text();
  if (!resp.ok) {
    return json(resp.status, {
      error: "Storefront rejected snapshot",
      status: resp.status,
      response: respText.slice(0, 1000),
      endpoint,
      sent_items: items.length,
    });
  }

  return json(200, {
    ok: true,
    endpoint,
    sent_items: items.length,
    items,
    storefront_response: respText.slice(0, 1000),
  });
});
