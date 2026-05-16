// Authenticated RPC for the external multi-tenant platform.
// Uses HMAC (shared secret = PRINTONET_PLATFORM_HMAC_SECRET) so the
// service-role key never has to leave Lovable Cloud.
//
// Request:
//   POST /functions/v1/platform-rpc
//   Headers:
//     content-type: application/json
//     x-printonet-timestamp: <unix seconds>
//     x-printonet-signature: hex( HMAC_SHA256(secret, `${timestamp}.${rawBody}`) )
//   Body: { "op": "<operation>", "params": { ... } }
//
// Whitelisted ops (extend as needed):
//   - get_user_store_limit       { user_id }
//   - get_active_subscription    { user_id, environment? }
//   - list_user_corporate_stores { user_id }
//   - set_user_stores_status     { user_id, status: "active" | "paused" }

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_SKEW_SECONDS = 300;

function hexFromBuffer(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return hexFromBuffer(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const secret = Deno.env.get("PRINTONET_PLATFORM_HMAC_SECRET");
  if (!secret) return json(500, { error: "server_misconfigured" });

  const tsHeader = req.headers.get("x-printonet-timestamp");
  const sigHeader = req.headers.get("x-printonet-signature");
  if (!tsHeader || !sigHeader) return json(401, { error: "missing_signature" });

  const ts = Number(tsHeader);
  if (!Number.isFinite(ts)) return json(401, { error: "bad_timestamp" });
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > MAX_SKEW_SECONDS) return json(401, { error: "stale_request" });

  const rawBody = await req.text();
  const expected = await hmacSha256Hex(secret, `${tsHeader}.${rawBody}`);
  if (!timingSafeEqual(expected, sigHeader.toLowerCase())) {
    return json(401, { error: "bad_signature" });
  }

  let payload: { op?: string; params?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const op = payload.op;
  const params = payload.params ?? {};
  if (!op || typeof op !== "string") return json(400, { error: "missing_op" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    switch (op) {
      case "get_user_store_limit": {
        const userId = String(params.user_id ?? "");
        if (!userId) return json(400, { error: "user_id_required" });
        const { data, error } = await supabase.rpc("printonet_user_store_limit", {
          p_user_id: userId,
        });
        if (error) throw error;
        return json(200, { limit: data });
      }

      case "get_active_subscription": {
        const userId = String(params.user_id ?? "");
        const environment = String(params.environment ?? "live");
        if (!userId) return json(400, { error: "user_id_required" });
        const { data, error } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .eq("environment", environment)
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return json(200, { subscription: data });
      }

      case "list_user_corporate_stores": {
        const userId = String(params.user_id ?? "");
        if (!userId) return json(400, { error: "user_id_required" });
        const { data, error } = await supabase
          .from("corporate_stores")
          .select("id, name, tenant_slug, status, custom_domain, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json(200, { stores: data ?? [] });
      }

      case "set_user_stores_status": {
        const userId = String(params.user_id ?? "");
        const status = String(params.status ?? "");
        if (!userId) return json(400, { error: "user_id_required" });
        if (status !== "active" && status !== "paused") {
          return json(400, { error: "invalid_status" });
        }
        const { error } = await supabase.rpc("printonet_set_user_stores_status", {
          p_user_id: userId,
          p_status: status,
        });
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "get_store_by_domain": {
        const raw = String(params.custom_domain ?? params.domain ?? "").trim().toLowerCase();
        const domain = raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
        if (!domain) return json(400, { error: "custom_domain_required" });
        const { data, error } = await supabase
          .from("corporate_stores")
          .select(
            "id, user_id, name, tenant_slug, status, custom_domain, contact_email, " +
              "primary_color, accent_color, font_family, logo_url, secondary_logo_url, favicon_url, " +
              "stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, " +
              "platform_fee_bps, tax_enabled, shipping_label, shipping_flat_amount, free_shipping_threshold",
          )
          .eq("status", "active")
          .ilike("custom_domain", domain)
          .maybeSingle();
        if (error) throw error;
        if (!data) return json(404, { error: "store_not_found" });
        return json(200, { store: data });
      }

      case "get_store_by_slug": {
        const slug = String(params.tenant_slug ?? "").trim().toLowerCase();
        if (!slug) return json(400, { error: "tenant_slug_required" });
        const { data, error } = await supabase
          .from("corporate_stores")
          .select(
            "id, user_id, name, tenant_slug, status, custom_domain, contact_email, " +
              "primary_color, accent_color, font_family, logo_url, secondary_logo_url, favicon_url, " +
              "stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, " +
              "platform_fee_bps, tax_enabled, shipping_label, shipping_flat_amount, free_shipping_threshold",
          )
          .eq("status", "active")
          .ilike("tenant_slug", slug)
          .maybeSingle();
        if (error) throw error;
        if (!data) return json(404, { error: "store_not_found" });
        return json(200, { store: data });
      }

      case "list_store_products": {
        const storeId = String(params.store_id ?? "");
        if (!storeId) return json(400, { error: "store_id_required" });
        const { data: links, error: linksErr } = await supabase
          .from("corporate_store_products")
          .select("id, store_id, product_id, sort_order, is_active")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (linksErr) throw linksErr;
        const ids = (links ?? []).map((l) => l.product_id);
        if (ids.length === 0) return json(200, { products: [] });
        const { data: prods, error: prodsErr } = await supabase
          .from("inventory_products")
          .select(
            "id, name, description, category, base_price, sale_price, " +
              "image_front, image_back, image_side1, image_side2, variants, decoration_methods, " +
              "product_type, inventory, status, weight, weight_unit, length, width, height, dimension_unit",
          )
          .in("id", ids)
          .eq("is_active", true);
        if (prodsErr) throw prodsErr;
        const byId = new Map((prods ?? []).map((p) => [p.id, p]));
        const products = (links ?? []).map((l) => ({
          ...l,
          inventory_products: byId.get(l.product_id) ?? null,
        }));
        return json(200, { products });
      }

      case "get_store_product": {
        const storeId = String(params.store_id ?? "");
        const productId = String(params.product_id ?? "");
        if (!storeId || !productId) {
          return json(400, { error: "store_id_and_product_id_required" });
        }
        const { data: link, error: linkErr } = await supabase
          .from("corporate_store_products")
          .select("id, store_id, product_id, sort_order, is_active")
          .eq("store_id", storeId)
          .eq("product_id", productId)
          .eq("is_active", true)
          .maybeSingle();
        if (linkErr) throw linkErr;
        if (!link) return json(404, { error: "product_not_found" });
        const { data: prod, error: prodErr } = await supabase
          .from("inventory_products")
          .select("*")
          .eq("id", productId)
          .maybeSingle();
        if (prodErr) throw prodErr;
        return json(200, { product: { ...link, inventory_products: prod } });
      }

      case "create_order": {
        const order = (params.order ?? {}) as Record<string, unknown>;
        const items = Array.isArray(params.items) ? (params.items as Record<string, unknown>[]) : [];
        if (!order.store_id) return json(400, { error: "order.store_id_required" });
        if (items.length === 0) return json(400, { error: "items_required" });

        const { data: insertedOrder, error: orderErr } = await supabase
          .from("orders")
          .insert({
            store_id: order.store_id,
            session_id: order.session_id ?? null,
            stripe_checkout_id: order.stripe_checkout_id ?? null,
            stripe_payment_intent: order.stripe_payment_intent ?? null,
            stripe_account_id: order.stripe_account_id ?? null,
            customer_email: order.customer_email ?? null,
            amount_total: order.amount_total ?? null,
            application_fee_amount: order.application_fee_amount ?? null,
            currency: order.currency ?? "usd",
            status: order.status ?? "pending",
            environment: order.environment ?? "sandbox",
          })
          .select("*")
          .single();
        if (orderErr) throw orderErr;

        const itemRows = items.map((it) => ({
          order_id: insertedOrder.id,
          store_product_id: it.store_product_id ?? null,
          inventory_product_id: it.inventory_product_id ?? null,
          name: it.name,
          image_url: it.image_url ?? null,
          unit_amount: it.unit_amount,
          quantity: it.quantity,
          currency: it.currency ?? insertedOrder.currency ?? "usd",
          variant_color: it.variant_color ?? null,
          variant_size: it.variant_size ?? null,
          sku: it.sku ?? null,
        }));
        const { data: insertedItems, error: itemsErr } = await supabase
          .from("order_items")
          .insert(itemRows)
          .select("*");
        if (itemsErr) throw itemsErr;

        return json(200, { order: insertedOrder, items: insertedItems });
      }

      case "update_order": {
        const orderId = String(params.order_id ?? "");
        const patch = (params.patch ?? {}) as Record<string, unknown>;
        if (!orderId) return json(400, { error: "order_id_required" });
        const allowed = [
          "status",
          "amount_total",
          "application_fee_amount",
          "currency",
          "stripe_checkout_id",
          "stripe_payment_intent",
          "stripe_account_id",
          "customer_email",
          "environment",
          "tracking_number",
          "carrier",
          "shipped_at",
          "delivered_at",
          "refunded_amount",
          "last_refund_id",
        ];
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of allowed) if (k in patch) update[k] = patch[k];
        const { data, error } = await supabase
          .from("orders")
          .update(update)
          .eq("id", orderId)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        if (!data) return json(404, { error: "order_not_found" });
        return json(200, { order: data });
      }

      case "get_order": {
        const orderId = String(params.order_id ?? "");
        if (!orderId) return json(400, { error: "order_id_required" });
        const { data: order, error: orderErr } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .maybeSingle();
        if (orderErr) throw orderErr;
        if (!order) return json(404, { error: "order_not_found" });
        const { data: items, error: itemsErr } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", orderId);
        if (itemsErr) throw itemsErr;
        return json(200, { order, items: items ?? [] });
      }

      case "get_store_shipping_settings": {
        const storeId = String(params.store_id ?? "");
        if (!storeId) return json(400, { error: "store_id_required" });
        const { data, error } = await supabase
          .from("corporate_stores")
          .select("id, tax_enabled, shipping_label, shipping_flat_amount, free_shipping_threshold")
          .eq("id", storeId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return json(404, { error: "store_not_found" });
        return json(200, { settings: data });
      }

      case "update_store_shipping_settings": {
        const storeId = String(params.store_id ?? "");
        const patch = (params.patch ?? {}) as Record<string, unknown>;
        if (!storeId) return json(400, { error: "store_id_required" });
        const allowed = ["tax_enabled", "shipping_label", "shipping_flat_amount", "free_shipping_threshold"];
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of allowed) if (k in patch) update[k] = patch[k];
        const { data, error } = await supabase
          .from("corporate_stores")
          .update(update)
          .eq("id", storeId)
          .select("id, tax_enabled, shipping_label, shipping_flat_amount, free_shipping_threshold")
          .maybeSingle();
        if (error) throw error;
        if (!data) return json(404, { error: "store_not_found" });
        return json(200, { settings: data });
      }

      case "update_store_stripe": {
        const storeId = String(params.store_id ?? "");
        const patch = (params.patch ?? {}) as Record<string, unknown>;
        if (!storeId) return json(400, { error: "store_id_required" });
        const allowed = [
          "stripe_account_id",
          "stripe_charges_enabled",
          "stripe_payouts_enabled",
          "stripe_details_submitted",
          "stripe_connected_at",
        ];
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        for (const k of allowed) if (k in patch) update[k] = patch[k];
        const { data, error } = await supabase
          .from("corporate_stores")
          .update(update)
          .eq("id", storeId)
          .select(
            "id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_connected_at",
          )
          .maybeSingle();
        if (error) throw error;
        if (!data) return json(404, { error: "store_not_found" });
        return json(200, { store: data });
      }

      case "record_webhook_event": {
        const eventId = String(params.event_id ?? "");
        const eventType = String(params.type ?? "");
        if (!eventId || !eventType) {
          return json(400, { error: "event_id_and_type_required" });
        }
        const { error } = await supabase
          .from("stripe_webhook_events")
          .insert({ event_id: eventId, type: eventType });
        if (error) {
          // 23505 = unique_violation → already processed (idempotent)
          if ((error as { code?: string }).code === "23505") {
            return json(200, { recorded: false, duplicate: true });
          }
          throw error;
        }
        return json(200, { recorded: true, duplicate: false });
      }

      case "upsert_customer": {
        const storeId = String(params.store_id ?? "");
        const authUserId = String(params.auth_user_id ?? "");
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!storeId || !authUserId || !email) {
          return json(400, { error: "store_id_auth_user_id_email_required" });
        }
        const patch: Record<string, unknown> = {
          store_id: storeId,
          auth_user_id: authUserId,
          email,
          updated_at: new Date().toISOString(),
        };
        if (params.full_name !== undefined) patch.full_name = params.full_name;
        if (params.phone !== undefined) patch.phone = params.phone;
        const { data, error } = await supabase
          .from("customer_profiles")
          .upsert(patch, { onConflict: "store_id,auth_user_id" })
          .select("*")
          .single();
        if (error) throw error;
        return json(200, { customer: data });
      }

      case "list_customers": {
        const storeId = String(params.store_id ?? "");
        if (!storeId) return json(400, { error: "store_id_required" });
        const search = String(params.search ?? "").trim().toLowerCase();
        const limit = Math.min(Number(params.limit ?? 200), 1000);
        let q = supabase
          .from("customer_profiles")
          .select("*")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (search) q = q.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
        const { data, error } = await q;
        if (error) throw error;
        return json(200, { customers: data ?? [] });
      }

      case "get_customer": {
        const customerId = String(params.customer_id ?? "");
        const storeId = String(params.store_id ?? "");
        const authUserId = String(params.auth_user_id ?? "");
        let q = supabase.from("customer_profiles").select("*");
        if (customerId) q = q.eq("id", customerId);
        else if (storeId && authUserId) q = q.eq("store_id", storeId).eq("auth_user_id", authUserId);
        else return json(400, { error: "customer_id_or_store_and_auth_user_required" });
        const { data, error } = await q.maybeSingle();
        if (error) throw error;
        if (!data) return json(404, { error: "customer_not_found" });
        return json(200, { customer: data });
      }

      case "set_customer_disabled": {
        const customerId = String(params.customer_id ?? "");
        const disabled = Boolean(params.disabled);
        if (!customerId) return json(400, { error: "customer_id_required" });
        const { data, error } = await supabase
          .from("customer_profiles")
          .update({ disabled_at: disabled ? new Date().toISOString() : null })
          .eq("id", customerId)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        if (!data) return json(404, { error: "customer_not_found" });
        return json(200, { customer: data });
      }

      case "delete_customer": {
        const customerId = String(params.customer_id ?? "");
        if (!customerId) return json(400, { error: "customer_id_required" });
        const { error } = await supabase
          .from("customer_profiles")
          .delete()
          .eq("id", customerId);
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "list_customer_addresses": {
        const customerId = String(params.customer_id ?? "");
        if (!customerId) return json(400, { error: "customer_id_required" });
        const { data, error } = await supabase
          .from("customer_addresses")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json(200, { addresses: data ?? [] });
      }

      case "upsert_customer_address": {
        const address = (params.address ?? {}) as Record<string, unknown>;
        const id = address.id ? String(address.id) : null;
        const customerId = String(address.customer_id ?? "");
        const storeId = String(address.store_id ?? "");
        if (!customerId || !storeId) return json(400, { error: "customer_id_and_store_id_required" });
        if (!id && !address.line1) return json(400, { error: "line1_required" });

        const allowed = [
          "label", "full_name", "line1", "line2", "city", "region",
          "postal_code", "country", "phone", "is_default_shipping", "is_default_billing",
        ];
        const row: Record<string, unknown> = {
          customer_id: customerId,
          store_id: storeId,
          updated_at: new Date().toISOString(),
        };
        for (const k of allowed) if (k in address) row[k] = address[k];

        // If this address is being marked as default, clear others first.
        if (row.is_default_shipping === true) {
          await supabase
            .from("customer_addresses")
            .update({ is_default_shipping: false })
            .eq("customer_id", customerId);
        }
        if (row.is_default_billing === true) {
          await supabase
            .from("customer_addresses")
            .update({ is_default_billing: false })
            .eq("customer_id", customerId);
        }

        let result;
        if (id) {
          result = await supabase
            .from("customer_addresses")
            .update(row)
            .eq("id", id)
            .select("*")
            .maybeSingle();
        } else {
          result = await supabase
            .from("customer_addresses")
            .insert(row)
            .select("*")
            .single();
        }
        if (result.error) throw result.error;
        return json(200, { address: result.data });
      }

      case "delete_customer_address": {
        const addressId = String(params.address_id ?? "");
        if (!addressId) return json(400, { error: "address_id_required" });
        const { error } = await supabase
          .from("customer_addresses")
          .delete()
          .eq("id", addressId);
        if (error) throw error;
        return json(200, { ok: true });
      }

      case "list_customer_orders": {
        const customerId = String(params.customer_id ?? "");
        const storeId = String(params.store_id ?? "");
        const limit = Math.min(Number(params.limit ?? 100), 500);
        if (!customerId && !storeId) return json(400, { error: "customer_id_or_store_id_required" });

        let email: string | null = null;
        if (customerId) {
          const { data: cust, error: custErr } = await supabase
            .from("customer_profiles")
            .select("email, store_id")
            .eq("id", customerId)
            .maybeSingle();
          if (custErr) throw custErr;
          if (!cust) return json(404, { error: "customer_not_found" });
          email = cust.email;
        }
        let q = supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (storeId) q = q.eq("store_id", storeId);
        if (email) q = q.ilike("customer_email", email);
        const { data: orders, error } = await q;
        if (error) throw error;

        const ids = (orders ?? []).map((o) => o.id);
        let items: Record<string, unknown>[] = [];
        if (ids.length > 0) {
          const { data: itemRows, error: itemsErr } = await supabase
            .from("order_items")
            .select("*")
            .in("order_id", ids);
          if (itemsErr) throw itemsErr;
          items = itemRows ?? [];
        }
        return json(200, { orders: orders ?? [], items });
      }

      case "customer_order_counts": {
        const storeId = String(params.store_id ?? "");
        const customerIds = Array.isArray(params.customer_ids) ? params.customer_ids as string[] : [];
        if (!storeId) return json(400, { error: "store_id_required" });
        if (customerIds.length === 0) return json(200, { counts: {} });

        const { data: customers, error: cErr } = await supabase
          .from("customer_profiles")
          .select("id, email")
          .in("id", customerIds);
        if (cErr) throw cErr;
        const emails = (customers ?? []).map((c) => c.email).filter(Boolean) as string[];
        if (emails.length === 0) return json(200, { counts: {} });

        const { data: orders, error: oErr } = await supabase
          .from("orders")
          .select("customer_email, amount_total")
          .eq("store_id", storeId)
          .in("customer_email", emails);
        if (oErr) throw oErr;

        const byEmail: Record<string, { count: number; total: number }> = {};
        for (const o of orders ?? []) {
          const k = (o.customer_email ?? "").toLowerCase();
          if (!k) continue;
          if (!byEmail[k]) byEmail[k] = { count: 0, total: 0 };
          byEmail[k].count += 1;
          byEmail[k].total += o.amount_total ?? 0;
        }
        const counts: Record<string, { count: number; total: number }> = {};
        for (const c of customers ?? []) {
          const k = (c.email ?? "").toLowerCase();
          counts[c.id] = byEmail[k] ?? { count: 0, total: 0 };
        }
        return json(200, { counts });
      }

      default:
        return json(400, { error: "unknown_op", op });
    }
  } catch (err) {
    const e = err as { message?: string; code?: string; details?: string; hint?: string };
    const message = e?.message ?? (typeof err === "string" ? err : JSON.stringify(err));
    return json(500, {
      error: "rpc_failed",
      message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
    });
  }
});
