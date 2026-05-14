// Outbound: POST {wp_site_url || TENANT_BASE_URL}/wp-json/printonet/v1/suppliers/sync
// Signed with timestamp+body HMAC (see _shared/printonet-tenant.ts).
//
// Caller can supply:
//   - product_ids: string[]  (preferred — function loads full rows from DB)
//   - products:    full CatalogProduct[] (advanced — used as-is)
//   - neither:     all active products for the authenticated user are pushed
//
// Each item sent to the tenant engine includes the COMPLETE product record:
// images (front/back/side1/side2), full variants jsonb (colors/sizes/per-size
// pricing & SKUs), dimensions, weight, print areas, supplier source, status,
// product_type, sale_price, plus a category tree.

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
  // Full product fields
  sale_price_cents?: number | null;
  product_type?: string;
  status?: string;
  images?: {
    front?: string | null;
    back?: string | null;
    side1?: string | null;
    side2?: string | null;
  };
  variants?: unknown;
  print_areas?: unknown;
  supplier_source?: unknown;
  weight?: number | null;
  weight_unit?: string | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimension_unit?: string | null;
  inventory?: { unlimited_stock?: boolean; stock?: number | null } | null;
  created_at?: string;
  updated_at?: string;
}

interface SyncRequest {
  tenant_slug: string;
  /** @deprecated legacy WordPress host. Ignored — kept for backwards compat. */
  wp_site_url?: string;
  /** Optional custom domain connected to the storefront (e.g. merch.brand.com). */
  custom_domain?: string;
  products?: CatalogProduct[];
  product_ids?: string[];
  limit?: number;
  event_id?: string;
  dry_run?: boolean;
  /**
   * "full"        — push entire catalog and prune missing SKUs on tenant (default for Sync All).
   * "incremental" — push items only, no pruning.
   * "delete"      — only send removed_skus.
   */
  mode?: "full" | "incremental" | "delete";
  removed_skus?: string[];
  prune?: boolean;
  /**
   * Per-product image URL overrides keyed by product id, used when a corporate
   * store needs a logo baked into the mockup before pushing. Each view (front/
   * back/side1/side2) is replaced with the supplied URL when present.
   */
  image_overrides?: Record<
    string,
    Partial<{ front: string; back: string; side1: string; side2: string }>
  >;
  /**
   * When set, every item is flagged as customizable on the tenant and given
   * a `customizer_url` of `${customizer_base_url}/s/${tenant_slug}/customize/${product_id}`.
   * The tenant plugin uses this to swap the "Add to cart" button for a
   * "Customize" button on enabled products.
   */
  customizable?: boolean;
  customizer_base_url?: string;
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

const FULL_COLUMNS =
  "id,name,description,base_price,sale_price,variants,category,category_id,subcategory_id," +
  "image_front,image_back,image_side1,image_side2,print_areas,supplier_source," +
  "product_type,status,weight,weight_unit,length,width,height,dimension_unit," +
  "inventory,created_at,updated_at";

function buildCatalogProduct(p: any, catById: Map<string, { id: string; name: string }>): CatalogProduct {
  const item: CatalogProduct = {
    id: p.id,
    name: p.name,
    price_cents: variantPriceCents(p),
    currency_code: "usd",
    sale_price_cents:
      p.sale_price != null && Number.isFinite(Number(p.sale_price))
        ? Math.max(0, Math.round(Number(p.sale_price) * 100))
        : null,
    product_type: p.product_type ?? undefined,
    status: p.status ?? undefined,
    images: {
      front: p.image_front ?? null,
      back: p.image_back ?? null,
      side1: p.image_side1 ?? null,
      side2: p.image_side2 ?? null,
    },
    variants: p.variants ?? [],
    print_areas: p.print_areas ?? {},
    supplier_source: p.supplier_source ?? null,
    weight: p.weight ?? null,
    weight_unit: p.weight_unit ?? null,
    length: p.length ?? null,
    width: p.width ?? null,
    height: p.height ?? null,
    dimension_unit: p.dimension_unit ?? null,
    inventory: p.inventory ?? { unlimited_stock: true, stock: null },
    created_at: p.created_at ?? undefined,
    updated_at: p.updated_at ?? undefined,
  };
  if (p.description) item.description = String(p.description).trim().slice(0, 5000);
  const root = p.category_id ? catById.get(p.category_id) : null;
  const sub = p.subcategory_id ? catById.get(p.subcategory_id) : null;
  if (root) {
    item.category = root.name;
    item.category_name = root.name;
    item.categories = [
      sub ? { name: root.name, children: [{ name: sub.name }] } : { name: root.name },
    ];
  } else if (p.category) {
    item.category = p.category;
    item.category_name = p.category;
  }
  if (sub) {
    item.subcategory = sub.name;
    item.subcategory_name = sub.name;
  }
  return item;
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

  const mode: "full" | "incremental" | "delete" = body.mode ?? "full";
  const removedSkus = Array.isArray(body.removed_skus)
    ? body.removed_skus.filter((s) => typeof s === "string" && s.length > 0)
    : [];

  let products: CatalogProduct[] = [];
  let categoriesOut: Array<{
    id: string;
    name: string;
    slug?: string;
    parent_id?: string | null;
    sort_order?: number;
    kind?: string;
  }> = [];
  const hasInlineProducts = Array.isArray(body.products) && body.products.length > 0;
  const hasProductIds = Array.isArray(body.product_ids) && body.product_ids.length > 0;

  const slugify = (s: string) =>
    String(s ?? "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

  const loadCategoriesForUser = async (sb: any, userId: string) => {
    const [{ data: cats }, { data: links }] = await Promise.all([
      sb
        .from("product_categories")
        .select("id,name,kind,sort_order")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true }),
      sb
        .from("product_category_links")
        .select("category_id,subcategory_id,sort_order")
        .eq("user_id", userId),
    ]);
    const parentBySub = new Map<string, string>();
    (links ?? []).forEach((l: any) => {
      if (l?.subcategory_id && l?.category_id) parentBySub.set(l.subcategory_id, l.category_id);
    });
    return (cats ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      slug: slugify(c.name),
      parent_id: parentBySub.get(c.id) ?? null,
      sort_order: Number(c.sort_order ?? 0),
      kind: c.kind ?? "category",
    }));
  };

  if (mode === "delete") {
    if (removedSkus.length === 0) {
      return new Response(JSON.stringify({ error: "removed_skus_required_for_delete_mode" }), {
        status: 400,
        headers: { ...tenantCors, "Content-Type": "application/json" },
      });
    }
    // products stays empty; we'll send removed_skus only.
  } else if (hasInlineProducts && !hasProductIds) {
    products = body.products!.slice(0, MAX_BATCH);
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

    let query = supabase
      .from("inventory_products")
      .select(FULL_COLUMNS)
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (hasProductIds) {
      query = query.in("id", body.product_ids!.slice(0, MAX_BATCH));
    } else {
      query = query.limit(Math.min(body.limit ?? MAX_BATCH, MAX_BATCH));
    }

    const { data: rows, error } = await query;
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

    try {
      categoriesOut = await loadCategoriesForUser(supabase, user.id);
    } catch (_) {
      categoriesOut = [];
    }

    products = (rows ?? []).map((p: any) => buildCatalogProduct(p, catById));
  }


  const event_id =
    body.event_id ??
    `evt_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

  // Build the inline `items` array the tenant engine consumes directly.
  // Includes the full product record so the storefront can render images,
  // variants, dimensions, sale pricing, etc. without a follow-up pull.
  const items = products.map((p) => {
    const priceDollars = Math.max(0, Number(p.price_cents ?? 0)) / 100;
    const salePriceDollars =
      p.sale_price_cents != null
        ? Math.max(0, Number(p.sale_price_cents)) / 100
        : null;

    // Aggregate every supplier image we have: base front/back/side1/side2,
    // each variant's primary `image`, and every URL inside variant `gallery`
    // arrays. Deduped, order-preserving. Also expose a per-color image map so
    // tenant storefronts can render full color swatches + galleries without
    // having to walk the variants array themselves.
    const gallery: string[] = [];
    const seen = new Set<string>();
    const pushUrl = (u: unknown) => {
      if (typeof u !== "string") return;
      const url = u.trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      gallery.push(url);
    };
    const baseImgs = p.images ?? {};
    const override = body.image_overrides?.[p.id] ?? {};
    const imgs: Record<string, unknown> = {
      ...baseImgs,
      ...(override.front ? { front: override.front } : {}),
      ...(override.back ? { back: override.back } : {}),
      ...(override.side1 ? { side1: override.side1 } : {}),
      ...(override.side2 ? { side2: override.side2 } : {}),
    };
    // Collect every overridden (logo-baked) URL so we can force them to the
    // front of the gallery AND every per-color gallery — otherwise tenant
    // storefronts that switch images per color swatch render the supplier's
    // raw mockup with no logo on it.
    const overrideUrls: string[] = [];
    for (const k of ["front", "back", "side1", "side2"] as const) {
      const u = (override as any)[k];
      if (typeof u === "string" && u && !overrideUrls.includes(u)) overrideUrls.push(u);
    }
    pushUrl((imgs as any).front);
    pushUrl((imgs as any).back);
    pushUrl((imgs as any).side1);
    pushUrl((imgs as any).side2);

    const colorImages: Record<string, { image?: string; hex?: string; gallery: string[] }> = {};
    const variantsArr = Array.isArray(p.variants) ? (p.variants as any[]) : [];
    for (const v of variantsArr) {
      const colorName = typeof v?.color === "string" ? v.color : null;
      if (colorName && !colorImages[colorName]) {
        colorImages[colorName] = { image: v?.image, hex: v?.hex, gallery: [] };
      }
      pushUrl(v?.image);
      if (colorName) {
        const entry = colorImages[colorName];
        if (typeof v?.image === "string" && !entry.gallery.includes(v.image)) {
          entry.gallery.push(v.image);
        }
      }
      const vGallery = Array.isArray(v?.gallery) ? v.gallery : [];
      for (const u of vGallery) {
        pushUrl(u);
        if (colorName && typeof u === "string" && !colorImages[colorName].gallery.includes(u)) {
          colorImages[colorName].gallery.push(u);
        }
      }
    }

    const frontUrl = typeof (imgs as any).front === "string" ? (imgs as any).front : null;
    // Ensure every override (branded composite) is at the front of the gallery
    // and present in every per-color gallery, so swatch switches still show
    // the logo. Last pushed = first in gallery.
    for (let i = overrideUrls.length - 1; i >= 0; i--) {
      const u = overrideUrls[i];
      const idx = gallery.indexOf(u);
      if (idx > 0) gallery.splice(idx, 1);
      if (gallery[0] !== u) gallery.unshift(u);
    }
    if (frontUrl) {
      const idx = gallery.indexOf(frontUrl);
      if (idx > 0) {
        gallery.splice(idx, 1);
        gallery.unshift(frontUrl);
      }
    }
    // Inject overrides into every per-color gallery + set the swatch image to
    // the front override when present so color swatches show the branded mockup.
    if (overrideUrls.length > 0) {
      for (const colorName of Object.keys(colorImages)) {
        const entry = colorImages[colorName];
        const merged: string[] = [];
        for (const u of overrideUrls) if (!merged.includes(u)) merged.push(u);
        for (const u of entry.gallery) if (!merged.includes(u)) merged.push(u);
        entry.gallery = merged;
        if (frontUrl) entry.image = frontUrl;
      }
    }
    const imagesPayload = {
      ...(imgs as Record<string, unknown>),
      featured: frontUrl,
      primary: frontUrl,
      main: frontUrl,
      gallery,
      all: gallery,
      by_color: colorImages,
    };

    const inv = (p as any).inventory ?? { unlimited_stock: true, stock: null };
    const isUnlimited = inv?.unlimited_stock !== false;
    const stockNum = isUnlimited
      ? 9999
      : Math.max(0, Math.floor(Number(inv?.stock ?? 0)));

    // Mirror inventory semantics onto every variant size row so the tenant
    // engine's variable-product path doesn't default missing stock to 0.
    // Also include WooCommerce meta semantics:
    //   _stock_status = "instock" whenever we have stock (or unlimited)
    //   _manage_stock = "no" when unlimited, "yes" when finite
    const stockStatus = isUnlimited || stockNum > 0 ? "instock" : "outofstock";
    const manageStock = isUnlimited ? "no" : "yes";

    const variantsWithStock = Array.isArray(p.variants)
      ? (p.variants as any[]).map((v) => {
          // Replace the variant primary image with the front composite when
          // present so per-color swatch UIs in the tenant render the branded
          // mockup, and prepend overrides into the variant gallery.
          const baseGallery = Array.isArray(v?.gallery) ? v.gallery : [];
          const mergedGallery: string[] = [];
          for (const u of overrideUrls) if (!mergedGallery.includes(u)) mergedGallery.push(u);
          for (const u of baseGallery) if (typeof u === "string" && !mergedGallery.includes(u)) mergedGallery.push(u);
          return {
          ...v,
          ...(frontUrl ? { image: frontUrl } : {}),
          gallery: mergedGallery,
          unlimited_stock: isUnlimited,
          stock: stockNum,
          stock_status: stockStatus,
          manage_stock: manageStock,
          _stock_status: stockStatus,
          _manage_stock: manageStock,
          sizes: Array.isArray(v?.sizes)
            ? v.sizes.map((s: any) => {
                const sStock =
                  s?.stock != null && !isUnlimited ? Number(s.stock) : stockNum;
                const sStatus =
                  isUnlimited || sStock > 0 ? "instock" : "outofstock";
                return {
                  ...s,
                  unlimited_stock: isUnlimited,
                  stock: sStock,
                  stock_status: sStatus,
                  manage_stock: manageStock,
                  _stock_status: sStatus,
                  _manage_stock: manageStock,
                };
              })
            : v?.sizes,
          };
        })
      : p.variants;

    const customizerUrl =
      body.customizable && body.customizer_base_url
        ? `${body.customizer_base_url.replace(/\/$/, "")}/s/${body.tenant_slug}/customize/${p.id}`
        : null;

    return {
      sku: p.id,
      name: p.name,
      description: p.description,
      price: priceDollars,
      sale_price: salePriceDollars,
      stock: stockNum,
      unlimited_stock: isUnlimited,
      stock_status: stockStatus,
      manage_stock: manageStock,
      _stock_status: stockStatus,
      _manage_stock: manageStock,
      currency: (p.currency_code ?? "usd").toUpperCase(),
      ...(p.category ? { category: p.category, category_name: p.category } : {}),
      ...(p.subcategory ? { subcategory: p.subcategory, subcategory_name: p.subcategory } : {}),
      ...(p.categories ? { categories: p.categories } : {}),
      // Full product payload
      product_type: p.product_type,
      status: p.status,
      images: imagesPayload,
      featured_image: frontUrl,
      primary_image: frontUrl,
      image: frontUrl,
      gallery,
      image_count: gallery.length,
      variants: variantsWithStock,
      print_areas: p.print_areas,
      supplier_source: p.supplier_source,
      weight: p.weight,
      weight_unit: p.weight_unit,
      dimensions: {
        length: p.length,
        width: p.width,
        height: p.height,
        unit: p.dimension_unit,
      },
      // Customizer hook for tenant plugin
      is_customizable: !!customizerUrl,
      customizer_url: customizerUrl,
      meta: customizerUrl
        ? {
            _printonet_customizable: "yes",
            _printonet_customizer_url: customizerUrl,
            // Keys the Customizer Studio Woo plugin already reads:
            _cs_enabled: "1",
            _cs_product_id: p.id,
            _cs_customizer_url: customizerUrl,
          }
        : undefined,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });

  const shouldPrune = mode === "full" && (body.prune ?? true);

  const payload: Record<string, unknown> = {
    supplier: "printonet_internal",
    tenant_slug: body.tenant_slug,
    credentials: {},
    event_id,
    occurred_at: new Date().toISOString(),
  };

  if (mode === "delete") {
    payload.removed_skus = removedSkus;
  } else if (mode === "incremental") {
    // items wins over catalog on the tenant — send items only.
    payload.items = items;
    if (removedSkus.length) payload.removed_skus = removedSkus;
  } else {
    // full: send catalog only (omit items so tenant applies the full snapshot)
    // and request pruning of SKUs missing from the snapshot.
    payload.catalog = items;
    payload.prune_supplier_catalog = shouldPrune;
    if (removedSkus.length) payload.removed_skus = removedSkus;
  }

  if (categoriesOut.length > 0 && mode !== "delete") {
    payload.categories = categoriesOut;
  }

  const meta = {
    event_id,
    mode,
    product_count: products.length,
    removed_count: removedSkus.length,
    pruned: shouldPrune,
  };

  // Storefront routing:
  //   - Path-based default:  https://stores.printonet.com/api/public/<slug>/suppliers/sync
  //   - Custom domain:       https://<custom_domain>/api/public/<slug>/suppliers/sync
  // The TanStack storefront exposes /api/public/* — no /wp-json/ on this side.
  const storefrontDefault =
    Deno.env.get("PRINTONET_STOREFRONT_BASE_URL")?.replace(/\/+$/, "") ||
    "https://stores.printonet.com";
  const customDomain = typeof body.custom_domain === "string" ? body.custom_domain.trim() : "";
  const baseUrlOverride = customDomain
    ? `https://${customDomain.replace(/^https?:\/\//i, "").replace(/\/.*$/, "")}`
    : storefrontDefault;
  const slugPath = encodeURIComponent(body.tenant_slug);
  const suppliersPath = `/api/public/${slugPath}/suppliers/sync`;
  const flagsPath = `/api/public/${slugPath}/customizer-flags`;

  if (body.dry_run) {
    return new Response(
      JSON.stringify({
        path: suppliersPath,
        base_url: baseUrlOverride,
        ...meta,
        payload_preview: payload,
      }),
      { status: 200, headers: { ...tenantCors, "Content-Type": "application/json" } },
    );
  }

  const result = await signedTenantCall(suppliersPath, {
    method: "POST",
    body: payload,
    baseUrlOverride,
  });

  if ("error" in result) {
    return new Response(
      JSON.stringify({ ok: false, ...meta, ...result }),
      { status: 200, headers: { ...tenantCors, "Content-Type": "application/json" } },
    );
  }

  // After a successful sync, also push customizer flags so the storefront
  // can render the "Customize" button on enabled products.
  let flags_result: unknown = null;
  if (body.customizable && body.customizer_base_url && (mode === "incremental" || mode === "full")) {
    const flagItems = items
      .filter((it) => it && (it as any).customizer_url)
      .map((it) => ({
        sku: (it as any).sku,
        name: (it as any).name,
        customizer_url: (it as any).customizer_url,
      }));
    if (flagItems.length) {
      flags_result = await signedTenantCall(flagsPath, {
        method: "POST",
        body: { items: flagItems },
        baseUrlOverride,
      });
    }
  }

  return new Response(
    JSON.stringify({ ...result, ...meta, flags_result }),
    { status: 200, headers: { ...tenantCors, "Content-Type": "application/json" } },
  );
});
