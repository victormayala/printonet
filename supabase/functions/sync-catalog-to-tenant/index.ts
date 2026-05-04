// Outbound: POST {TENANT_BASE_URL}/wp-json/printonet/v1/suppliers/sync
// Signed with timestamp+body HMAC (see _shared/printonet-tenant.ts).
//
// Payload shape sent to the tenant engine:
// {
//   tenant_slug: string,
//   event_id: string,
//   occurred_at: string (ISO-8601),
//   products: [
//     { id, name, description?, price_cents, currency_code }
//   ]
// }
//
// Caller can supply `products` directly or let us pull active products from
// inventory_products for the authenticated user.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { signedTenantCall, tenantCors } from "../_shared/printonet-tenant.ts";

const MAX_BATCH = 200;

interface CatalogProduct {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  currency_code?: string;
  category?: string;
  subcategory?: string;
  category_name?: string;
  subcategory_name?: string;
  categories?: Array<string | { name: string; children?: Array<{ name: string }> }>;
}

interface SyncRequest {
  tenant_slug: string;
  wp_site_url?: string;
  products?: CatalogProduct[];
  limit?: number;
  event_id?: string;
  dry_run?: boolean;
}

function variantPriceCents(p: any): number {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const prices: number[] = [];
  for (const v of variants) {
    if (Array.isArray(v?.sizes)) {
      for (const s of v.sizes) {
        const n = Number(s?.price);
        if (Number.isFinite(n) && n > 0) prices.push(n);
      }
    }
    const vp = Number(v?.price);
    if (Number.isFinite(vp) && vp > 0) prices.push(vp);
  }
  const lowest = prices.length ? Math.min(...prices) : Number(p.base_price);
  const cents = Math.round((Number.isFinite(lowest) ? lowest : 0) * 100);
  return Math.max(0, cents);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: tenantCors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  let body: SyncRequest;
  try {
    body = (await req.json()) as SyncRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  if (!body.tenant_slug || typeof body.tenant_slug !== "string") {
    return new Response(JSON.stringify({ error: "tenant_slug_required" }), {
      status: 400,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  let products: CatalogProduct[] = [];
  if (Array.isArray(body.products) && body.products.length > 0) {
    products = body.products.slice(0, MAX_BATCH);
  } else {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...tenantCors, "Content-Type": "application/json" },
      });
    }
    const limit = Math.min(body.limit ?? MAX_BATCH, MAX_BATCH);
    const { data: rows, error } = await supabase
      .from("inventory_products")
      .select("id,name,description,base_price,variants,category_id,subcategory_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(limit);
    if (error) {
      return new Response(JSON.stringify({ error: "db_error", detail: error.message }), {
        status: 500,
        headers: { ...tenantCors, "Content-Type": "application/json" },
      });
    }
    const { data: cats } = await supabase
      .from("product_categories")
      .select("id,name")
      .eq("user_id", user.id);
    const catById = new Map<string, { id: string; name: string }>();
    (cats ?? []).forEach((c: any) => catById.set(c.id, c));

    products = (rows ?? []).map((p: any) => {
      const item: CatalogProduct = {
        id: p.id,
        name: p.name,
        price_cents: variantPriceCents(p),
        currency_code: "usd",
      };
      if (p.description) item.description = String(p.description).trim().slice(0, 2000);
      const root = p.category_id ? catById.get(p.category_id) : null;
      const sub = p.subcategory_id ? catById.get(p.subcategory_id) : null;
      if (root) {
        item.category = root.name;
        item.category_name = root.name;
        item.categories = [
          sub ? { name: root.name, children: [{ name: sub.name }] } : { name: root.name },
        ];
      }
      if (sub) {
        item.subcategory = sub.name;
        item.subcategory_name = sub.name;
      }
      return item;
    });
  }

  const event_id =
    body.event_id ??
    `evt_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

  // Build the inline `items` array the tenant engine consumes directly
  // (sku, name, numeric price, stock, plus category fields). This bypasses
  // the pull-from-feed path and ensures the storefront actually updates.
  const items = products.map((p) => ({
    sku: p.id,
    name: p.name,
    description: p.description,
    price: Math.max(0, Number(p.price_cents ?? 0)) / 100,
    stock: 9999,
    currency: (p.currency_code ?? "usd").toUpperCase(),
    ...(p.category ? { category: p.category, category_name: p.category } : {}),
    ...(p.subcategory ? { subcategory: p.subcategory, subcategory_name: p.subcategory } : {}),
    ...(p.categories ? { categories: p.categories } : {}),
  }));

  const payload = {
    supplier: "printonet_internal",
    tenant_slug: body.tenant_slug,
    credentials: {},
    event_id,
    occurred_at: new Date().toISOString(),
    products,
    items,
    catalog: items,
  };

  if (body.dry_run) {
    return new Response(
      JSON.stringify({
        path: "/wp-json/printonet/v1/suppliers/sync",
        event_id,
        product_count: products.length,
        payload_preview: payload,
      }),
      { status: 200, headers: { ...tenantCors, "Content-Type": "application/json" } },
    );
  }

  const result = await signedTenantCall("/wp-json/printonet/v1/suppliers/sync", {
    method: "POST",
    body: payload,
  });

  if ("error" in result) {
    return new Response(JSON.stringify(result), {
      status: 502,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ...result, event_id, product_count: products.length }),
    {
      status: result.ok ? 200 : 502,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    },
  );
});
