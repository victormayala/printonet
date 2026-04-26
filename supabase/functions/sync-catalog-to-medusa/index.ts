// Outbound webhook → @printonet/medusa-backend
// POST {PRINTONET_MEDUSA_URL}/admin/printonet/events
// Body: { id, type: "catalog.sync", tenantId, occurredAt, payload: { products: [...] } }
// Header: x-printonet-signature = lowercase hex HMAC-SHA256(rawBody, PRINTONET_WEBHOOK_SECRET)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BATCH = 200;

interface CatalogSyncProduct {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  currencyCode?: string;
}

interface SyncRequest {
  tenantId: string;
  // Optional: caller can pass a pre-built product list (e.g. from a custom selection).
  // If omitted, we pull active products from inventory_products for the calling user.
  products?: CatalogSyncProduct[];
  // Optional: limit how many DB products to send (defaults to MAX_BATCH).
  limit?: number;
  // Optional: deterministic event id for idempotency tests. If omitted we generate one.
  eventId?: string;
  // Optional: dry run — build + sign but don't POST. Useful for inspecting the payload.
  dryRun?: boolean;
}

function hexHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  return crypto.subtle
    .importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    .then((key) => crypto.subtle.sign("HMAC", key, enc.encode(message)))
    .then((sig) =>
      Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    );
}

function deriveCurrency(): string {
  return "usd";
}

function variantPriceCents(p: any): number {
  // Mapping rule (matches /mnt/documents/tenant-catalog-payload.README.md):
  // priceCents = round(min(variant.sizes[].price ?? variant.price) * 100),
  // falling back to base_price if no variants exist.
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SECRET = Deno.env.get("PRINTONET_WEBHOOK_SECRET");
  const RAW_URL = Deno.env.get("PRINTONET_MEDUSA_URL");
  if (!SECRET || !RAW_URL) {
    return new Response(
      JSON.stringify({
        error: "missing_config",
        detail:
          "PRINTONET_WEBHOOK_SECRET and PRINTONET_MEDUSA_URL must be set.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Normalize the URL: accept either a base ("https://ecomapi.printonet.com")
  // or a full path ("https://ecomapi.printonet.com/admin/printonet/events").
  const target = RAW_URL.replace(/\/+$/, "").endsWith(
    "/admin/printonet/events",
  )
    ? RAW_URL.replace(/\/+$/, "")
    : `${RAW_URL.replace(/\/+$/, "")}/admin/printonet/events`;

  let body: SyncRequest;
  try {
    body = (await req.json()) as SyncRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.tenantId || typeof body.tenantId !== "string") {
    return new Response(
      JSON.stringify({ error: "tenantId_required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Build product list -------------------------------------------------------
  let products: CatalogSyncProduct[] = [];

  if (Array.isArray(body.products) && body.products.length > 0) {
    products = body.products.slice(0, MAX_BATCH);
  } else {
    // Pull from DB for the authenticated user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = Math.min(body.limit ?? MAX_BATCH, MAX_BATCH);
    const { data: rows, error } = await supabase
      .from("inventory_products")
      .select("id,name,description,base_price,variants")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(limit);

    if (error) {
      return new Response(
        JSON.stringify({ error: "db_error", detail: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    products = (rows ?? []).map((p: any) => {
      const item: CatalogSyncProduct = {
        id: p.id,
        name: p.name,
        priceCents: variantPriceCents(p),
        currencyCode: deriveCurrency(),
      };
      if (p.description) {
        item.description = String(p.description).trim().slice(0, 2000);
      }
      return item;
    });
  }

  // Build envelope ----------------------------------------------------------
  const eventId =
    body.eventId ??
    `evt_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

  const envelope = {
    id: eventId,
    type: "catalog.sync" as const,
    tenantId: body.tenantId,
    occurredAt: new Date().toISOString(),
    payload: { products },
  };

  // CRITICAL: sign the exact bytes we send. Stringify ONCE, sign that string,
  // then send that same string as the body.
  const rawBody = JSON.stringify(envelope);
  const signature = await hexHmacSha256(SECRET, rawBody);

  if (body.dryRun) {
    return new Response(
      JSON.stringify({
        target,
        eventId,
        productCount: products.length,
        signature,
        rawBodyPreview: rawBody.slice(0, 500),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // POST to Medusa ----------------------------------------------------------
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-printonet-signature": signature,
      },
      body: rawBody,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "upstream_unreachable",
        detail: err instanceof Error ? err.message : String(err),
        target,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const upstreamText = await upstream.text();
  let upstreamJson: unknown = upstreamText;
  try {
    upstreamJson = JSON.parse(upstreamText);
  } catch {
    /* leave as text */
  }

  return new Response(
    JSON.stringify({
      ok: upstream.ok,
      status: upstream.status,
      eventId,
      productCount: products.length,
      target,
      response: upstreamJson,
    }),
    {
      status: upstream.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
