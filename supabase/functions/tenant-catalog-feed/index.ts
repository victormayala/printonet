// Inbound: GET /functions/v1/tenant-catalog-feed?tenant_slug=<slug>
//
// The WordPress tenant engine calls this to pull its store owner's catalog.
// Auth: same HMAC scheme used outbound (see _shared/printonet-tenant.ts).
//   X-Printonet-Timestamp: <unix_seconds>
//   X-Printonet-Signature: hex( HMAC-SHA256( `${ts}.${rawBody}`, PLATFORM_HMAC_SECRET ) )
// For GET requests rawBody is "" — tenant signs `${ts}.`.
//
// Resolves tenant_slug -> user_id by matching corporate_stores.tenant_slug,
// custom_domain, or wp_site_url, then returns that owner's active inventory_products in the
// normalized shape: { items: [{ sku, name, price, stock, ... }] }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hexHmacSha256 } from "../_shared/printonet-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-printonet-timestamp, x-printonet-signature",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const MAX_SKEW_SECONDS = 300;

function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return String(url).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  }
}

function normalizeSlug(s: string): string {
  return s.trim().toLowerCase().replace(/^www\./, "").replace(/\/+$/, "");
}

function totalStock(p: any): number {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  let total = 0;
  let saw = false;
  for (const v of variants) {
    if (Array.isArray(v?.sizes)) {
      for (const s of v.sizes) {
        const n = Number(s?.stock ?? s?.inventory ?? s?.qty);
        if (Number.isFinite(n)) { total += n; saw = true; }
      }
    }
    const vs = Number(v?.stock ?? v?.inventory ?? v?.qty);
    if (Number.isFinite(vs)) { total += vs; saw = true; }
  }
  return saw ? Math.max(0, total) : 0;
}

function lowestPrice(p: any): number {
  const prices: number[] = [];
  const variants = Array.isArray(p.variants) ? p.variants : [];
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
  if (prices.length) return Math.min(...prices);
  const base = Number(p.sale_price ?? p.base_price);
  return Number.isFinite(base) ? base : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const secret = Deno.env.get("PRINTONET_PLATFORM_HMAC_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "missing_config", detail: "PRINTONET_PLATFORM_HMAC_SECRET not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify HMAC.
  const ts = req.headers.get("x-printonet-timestamp") ?? "";
  const sig = req.headers.get("x-printonet-signature") ?? "";
  if (!ts || !sig) {
    return new Response(JSON.stringify({ error: "missing_signature_headers" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > MAX_SKEW_SECONDS) {
    return new Response(JSON.stringify({ error: "timestamp_skew" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const expected = await hexHmacSha256(secret, `${ts}.`);
  // constant-time-ish compare
  if (expected.length !== sig.length) {
    return new Response(JSON.stringify({ error: "bad_signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) {
    return new Response(JSON.stringify({ error: "bad_signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const tenantSlugRaw = url.searchParams.get("tenant_slug") ?? "";
  const tenantSlug = normalizeSlug(tenantSlugRaw);
  if (!tenantSlug) {
    return new Response(JSON.stringify({ error: "tenant_slug_required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500);

  // Service-role client (bypass RLS — auth was via HMAC).
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve tenant_slug -> user_id by matching tenant_slug, custom_domain, or wp_site_url.
  const { data: stores, error: storeErr } = await supabase
    .from("corporate_stores")
    .select("user_id, tenant_slug, custom_domain, wp_site_url, name, status");
  if (storeErr) {
    return new Response(JSON.stringify({ error: "db_error", detail: storeErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Helpers: extract the leftmost subdomain label and a name-slug.
  const firstLabel = (host: string) => host.split(".")[0] ?? "";
  const nameSlug = (n: string) =>
    n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // Legacy generated hosts sometimes include a trailing `-<hex>` suffix.
  const stripGeneratedSuffix = (label: string) =>
    label.replace(/-[a-f0-9]{6,}$/i, "");

  const tenantFirstLabel = firstLabel(tenantSlug);

  const candidates = (stores ?? []).map((s) => {
    const cdHost = hostOf(s.custom_domain);
    const wpHost = hostOf(s.wp_site_url);
    const wpLabel = firstLabel(wpHost);
    const wpBase = stripGeneratedSuffix(wpLabel);
    const storedSlug = normalizeSlug(s.tenant_slug ?? "");
    const ns = nameSlug(s.name ?? "");
    return { store: s, cdHost, wpHost, wpLabel, wpBase, storedSlug, ns };
  });

  let match = candidates.find((c) =>
    c.storedSlug === tenantSlug ||
    c.storedSlug === tenantFirstLabel ||
    c.cdHost === tenantSlug ||
    c.wpHost === tenantSlug ||
    normalizeSlug(c.store.custom_domain ?? "") === tenantSlug ||
    normalizeSlug(c.store.wp_site_url ?? "") === tenantSlug ||
    normalizeSlug(c.store.name ?? "") === tenantSlug ||
    c.wpLabel === tenantSlug ||
    c.wpBase === tenantSlug ||
    c.wpLabel === tenantFirstLabel ||
    c.wpBase === tenantFirstLabel ||
    c.ns === tenantSlug ||
    c.ns === tenantFirstLabel
  )?.store;

  // Fallback: if the WP plugin sends the platform host itself (e.g. "stores.printonet.com"),
  // and there is exactly one active corporate store, treat it as the implicit tenant.
  // This unblocks the single-tenant smoke-test case while we wire per-tenant slugs.
  if (!match) {
    const PLATFORM_HOSTS = new Set([
      "stores.printonet.com",
      "printonet.com",
      "www.printonet.com",
      "platform.printonet.com",
    ]);
    const activeStores = (stores ?? []).filter((s: any) => s.status !== "removed");
    if (PLATFORM_HOSTS.has(tenantSlug) && activeStores.length === 1) {
      match = activeStores[0];
    }
  }

  if (!match) {
    return new Response(
      JSON.stringify({
        error: "tenant_not_found",
        tenant_slug: tenantSlug,
        hint: "Send tenant_slug, the WordPress site host/subdomain, the store name slug, or a configured custom_domain.",
        known_tenants: candidates.map((c) => ({
          name: c.store.name,
          tenant_slug: c.storedSlug || null,
          custom_domain: c.cdHost || null,
          wp_host: c.wpHost || null,
          wp_label: c.wpLabel || null,
          wp_base: c.wpBase || null,
          name_slug: c.ns || null,
        })),
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { data: rows, error: prodErr } = await supabase
    .from("inventory_products")
    .select("id,name,description,base_price,sale_price,variants,image_front,is_active")
    .eq("user_id", match.user_id)
    .eq("is_active", true)
    .limit(limit);
  if (prodErr) {
    return new Response(JSON.stringify({ error: "db_error", detail: prodErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = (rows ?? []).map((p: any) => ({
    sku: p.id,
    name: p.name,
    description: p.description ? String(p.description).trim().slice(0, 2000) : undefined,
    price: Number(lowestPrice(p).toFixed(2)),
    currency: "usd",
    stock: totalStock(p),
    image: p.image_front ?? null,
  }));

  return new Response(
    JSON.stringify({
      tenant_slug: tenantSlug,
      generated_at: new Date().toISOString(),
      count: items.length,
      items,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
});
