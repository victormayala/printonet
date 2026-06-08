import { createClient } from "npm:@supabase/supabase-js@2";

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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function centsFromPrice(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function firstUrlFromSides(sides: unknown, field: "previewPNG" | "designPNG"): string | null {
  if (!Array.isArray(sides)) return null;
  for (const side of sides as Array<Record<string, unknown>>) {
    const url = stringOrNull(side?.[field]);
    if (url && /^https?:\/\//i.test(url)) return url;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const sessionId = stringOrNull(body.sessionId);
  const storeId = stringOrNull(body.storeId);
  if (!sessionId || !storeId) return json(400, { error: "sessionId and storeId are required" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: store, error: storeErr } = await admin
    .from("corporate_stores")
    .select("id, user_id, store_type, name")
    .eq("id", storeId)
    .maybeSingle();
  if (storeErr) return json(500, { error: storeErr.message });
  if (!store || store.store_type !== "shopify") return json(404, { error: "Shopify store not found" });

  const { data: session, error: sessionErr } = await admin
    .from("customizer_sessions")
    .select("id, user_id, store_id, customer_email, product_data, design_output, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionErr) return json(500, { error: sessionErr.message });
  if (!session) return json(404, { error: "Customizer session not found" });

  const ownsSession = session.store_id === store.id || session.user_id === store.user_id;
  if (!ownsSession) return json(403, { error: "Session does not belong to this Shopify store" });

  if (!session.store_id) {
    await admin.from("customizer_sessions").update({ store_id: store.id }).eq("id", session.id);
  }

  const productData = (session.product_data && typeof session.product_data === "object")
    ? session.product_data as Record<string, unknown>
    : {};
  const designOutput = (session.design_output && typeof session.design_output === "object")
    ? session.design_output as Record<string, unknown>
    : {};
  const sides = Array.isArray(body.sides) ? body.sides : designOutput.sides;

  const productName = stringOrNull(body.productName) || stringOrNull(productData.name) || "Customized product";
  const quantity = Math.max(1, Math.floor(Number(body.quantity || 1)) || 1);
  const currency = (stringOrNull(body.currency) || "usd").toLowerCase();
  const bodyUnitAmount = Number(body.unitAmount);
  const firstVariant = Array.isArray(productData.variants) ? productData.variants[0] as Record<string, unknown> | undefined : undefined;
  const unitAmount = Number.isFinite(bodyUnitAmount) && bodyUnitAmount > 0
    ? Math.round(bodyUnitAmount)
    : centsFromPrice(productData.base_price ?? firstVariant?.price);
  const previewUrl =
    stringOrNull(body.designPreviewUrl) ||
    firstUrlFromSides(sides, "previewPNG") ||
    firstUrlFromSides(sides, "designPNG");
  const printFileUrl =
    stringOrNull(body.printFileUrl) ||
    stringOrNull(designOutput.printFileUrl) ||
    stringOrNull(designOutput.print_file_url) ||
    firstUrlFromSides(sides, "designPNG");
  const layersUrl =
    stringOrNull(body.designLayersUrl) ||
    stringOrNull(designOutput.designLayersUrl) ||
    stringOrNull(designOutput.design_layers_url);

  const checkoutRef = `shopify-design:${session.id}`;
  const orderPayload = {
    store_id: store.id,
    session_id: session.id,
    stripe_checkout_id: checkoutRef,
    customer_email: session.customer_email,
    amount_total: unitAmount * quantity,
    currency,
    status: "design_ready",
    environment: "live",
  };

  const { data: existing } = await admin
    .from("orders")
    .select("id")
    .eq("stripe_checkout_id", checkoutRef)
    .maybeSingle();

  let orderId = existing?.id as string | undefined;
  if (orderId) {
    await admin.from("orders").update(orderPayload).eq("id", orderId);
    await admin.from("order_items").delete().eq("order_id", orderId);
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();
    if (insertErr || !inserted) return json(500, { error: insertErr?.message || "Order insert failed" });
    orderId = inserted.id;
  }

  const { error: itemErr } = await admin.from("order_items").insert({
    order_id: orderId,
    name: productName,
    image_url: previewUrl || printFileUrl,
    unit_amount: unitAmount,
    quantity,
    currency,
    sku: stringOrNull(body.sku) || stringOrNull(firstVariant?.sku),
    variant_color: stringOrNull(body.variantColor),
    variant_size: stringOrNull(body.variantSize),
    metadata: {
      source: "shopify_cart_capture",
      customizer_session_id: session.id,
      print_file_url: printFileUrl,
      design_preview_url: previewUrl,
      design_layers_url: layersUrl,
      customizer_sides: sides ?? null,
      shopify_variant_id: stringOrNull(body.shopifyVariantId),
      shopify_line_key: stringOrNull(body.shopifyLineKey),
      properties: body.properties && typeof body.properties === "object" ? body.properties : null,
    },
  });
  if (itemErr) return json(500, { error: itemErr.message });

  return json(200, { ok: true, order_id: orderId, session_id: session.id });
});