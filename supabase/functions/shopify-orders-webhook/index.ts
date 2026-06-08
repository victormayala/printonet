// Receives Shopify orders/paid (and orders/create) webhooks, verifies HMAC,
// and inserts a row into the orders + order_items tables so the Printonet
// Orders tab surfaces print files and design info for customized products.
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

function propsToObject(props: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(props)) {
    for (const p of props) {
      if (p && typeof p.name === "string") out[p.name] = String(p.value ?? "");
    }
  } else if (props && typeof props === "object") {
    for (const [k, v] of Object.entries(props)) out[k] = String(v ?? "");
  }
  return out;
}

export async function ingestShopifyOrder(
  admin: ReturnType<typeof createClient>,
  shopDomain: string,
  order: any,
): Promise<{ inserted: boolean; orderId?: string; reason?: string }> {
  if (!order?.id) return { inserted: false, reason: "missing order id" };

  // Find the integration + store for this shop domain.
  const storeUrl = `https://${shopDomain}`;
  const { data: integration } = await admin
    .from("store_integrations")
    .select("user_id, store_id")
    .eq("platform", "shopify")
    .eq("store_url", storeUrl)
    .maybeSingle();

  if (!integration?.store_id) {
    return { inserted: false, reason: `no integration for ${shopDomain}` };
  }

  const stripeCheckoutId = `shopify:${order.id}`;

  // Idempotency check.
  const { data: existing } = await admin
    .from("orders")
    .select("id")
    .eq("stripe_checkout_id", stripeCheckoutId)
    .maybeSingle();
  if (existing) return { inserted: false, orderId: existing.id, reason: "already ingested" };

  const amountCents = Math.round(parseFloat(order.total_price || "0") * 100);
  const currency = String(order.currency || "USD").toLowerCase();
  const email = order.email || order.contact_email || order.customer?.email || null;

  // First customizer session id we find (used for the order-level session link)
  let primarySessionId: string | null = null;
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  for (const li of lineItems) {
    const p = propsToObject(li.properties);
    if (p._customizer_session_id) {
      primarySessionId = p._customizer_session_id;
      break;
    }
  }

  // Confirm the session belongs to this store; otherwise null it.
  if (primarySessionId) {
    const { data: sess } = await admin
      .from("customizer_sessions")
      .select("id, store_id")
      .eq("id", primarySessionId)
      .maybeSingle();
    if (!sess || sess.store_id !== integration.store_id) primarySessionId = null;
  }

  const { data: inserted, error: insErr } = await admin
    .from("orders")
    .insert({
      store_id: integration.store_id,
      session_id: primarySessionId,
      stripe_checkout_id: stripeCheckoutId,
      customer_email: email,
      amount_total: amountCents,
      currency,
      status: "paid",
      environment: "live",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return { inserted: false, reason: insErr?.message || "insert failed" };
  }

  // Build order_items for each line, embedding customizer metadata.
  const rows = lineItems.map((li: any) => {
    const props = propsToObject(li.properties);
    let sides: unknown = null;
    try {
      sides = props._customizer_sides ? JSON.parse(props._customizer_sides) : null;
    } catch { /* keep null */ }
    const printFileUrl = props._customizer_print_file_url || null;
    const designUrl = props._customizer_design_url || null;
    const sessionId = props._customizer_session_id || null;
    const layersUrl = props._customizer_layers_url || null;

    return {
      order_id: inserted.id,
      name: String(li.title || li.name || "Item"),
      image_url: designUrl || printFileUrl || null,
      unit_amount: Math.round(parseFloat(li.price || "0") * 100),
      quantity: Number(li.quantity || 1),
      currency,
      sku: li.sku || null,
      variant_color: null,
      variant_size: null,
      metadata: {
        shopify_line_item_id: li.id ?? null,
        shopify_product_id: li.product_id ?? null,
        shopify_variant_id: li.variant_id ?? null,
        variant_title: li.variant_title ?? null,
        customizer_session_id: sessionId,
        customizer_print_file_url: printFileUrl,
        customizer_design_url: designUrl,
        customizer_layers_url: layersUrl,
        customizer_sides: sides,
        properties: props,
      },
    };
  });

  if (rows.length > 0) {
    const { error: itemsErr } = await admin.from("order_items").insert(rows);
    if (itemsErr) console.error("order_items insert failed:", itemsErr);
  }

  return { inserted: true, orderId: inserted.id };
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
