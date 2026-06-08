// Shared helper for ingesting a Shopify order payload into orders + order_items.
// Used by both shopify-orders-webhook (HMAC webhook) and
// shopify-register-orders-webhook (manual backfill).
import { createClient } from "npm:@supabase/supabase-js@2";

type SupabaseAdmin = ReturnType<typeof createClient>;

function propsToObject(props: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(props)) {
    for (const p of props as Array<{ name?: string; value?: unknown }>) {
      if (p && typeof p.name === "string") out[p.name] = String(p.value ?? "");
    }
  } else if (props && typeof props === "object") {
    for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
      out[k] = String(v ?? "");
    }
  }
  return out;
}

export async function ingestShopifyOrder(
  admin: SupabaseAdmin,
  shopDomain: string,
  order: any,
): Promise<{ inserted: boolean; orderId?: string; reason?: string }> {
  if (!order?.id) return { inserted: false, reason: "missing order id" };

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

  const { data: existing } = await admin
    .from("orders")
    .select("id")
    .eq("stripe_checkout_id", stripeCheckoutId)
    .maybeSingle();
  if (existing) return { inserted: false, orderId: existing.id, reason: "already ingested" };

  const amountCents = Math.round(parseFloat(order.total_price || "0") * 100);
  const currency = String(order.currency || "USD").toLowerCase();
  const email = order.email || order.contact_email || order.customer?.email || null;

  let primarySessionId: string | null = null;
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  for (const li of lineItems) {
    const p = propsToObject(li.properties);
    if (p._customizer_session_id) {
      primarySessionId = p._customizer_session_id;
      break;
    }
  }

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

  const rows = lineItems.map((li: any) => {
    const props = propsToObject(li.properties);
    let sides: unknown = null;
    try {
      sides = props._customizer_sides ? JSON.parse(props._customizer_sides) : null;
    } catch { /* ignore */ }
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
        print_file_url: printFileUrl,
        design_preview_url: designUrl,
        design_layers_url: layersUrl,
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
