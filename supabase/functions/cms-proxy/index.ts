// Authenticated proxy between the Printonet dashboard and the storefront
// CMS API. The HMAC secret never leaves the edge runtime.
//
// Request:
//   POST /functions/v1/cms-proxy
//   Authorization: Bearer <supabase user jwt>
//   Body: { store_id: uuid, action: string, body?: object, method?: "GET"|"POST" }
//
// We verify the caller owns the target corporate_store (or is super_admin),
// then sign + forward to `${PRINTONET_STOREFRONT_URL}/api/public/cms/<action>`
// using the tenant_slug as `x-platform-tenant`.

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

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return hex(sig);
}

const ACTION_RE = /^[a-z0-9-]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });

  const SECRET = Deno.env.get("PRINTONET_PLATFORM_HMAC_SECRET");
  const BASE = Deno.env.get("PRINTONET_STOREFRONT_URL");
  if (!SECRET || !BASE) {
    return json(500, { ok: false, error: "server_misconfigured" });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return json(401, { ok: false, error: "unauthorized" });
  }
  const userId = claimsData.claims.sub as string;

  let payload: { store_id?: string; action?: string; body?: unknown; method?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const { store_id, action, body, method } = payload;
  if (!store_id || typeof store_id !== "string") {
    return json(400, { ok: false, error: "store_id_required" });
  }
  if (!action || typeof action !== "string" || !ACTION_RE.test(action)) {
    return json(400, { ok: false, error: "invalid_action" });
  }

  // Authorize: caller must own the store (or be super_admin).
  const { data: store, error: storeErr } = await supabase
    .from("corporate_stores")
    .select("id, user_id, tenant_slug")
    .eq("id", store_id)
    .maybeSingle();

  if (storeErr) return json(500, { ok: false, error: storeErr.message });
  if (!store) return json(404, { ok: false, error: "store_not_found" });

  if (store.user_id !== userId) {
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleRow) return json(403, { ok: false, error: "forbidden" });
  }

  if (!store.tenant_slug) {
    return json(400, { ok: false, error: "store_has_no_tenant_slug" });
  }

  // Normalize: force https, strip trailing slashes, no double slashes.
  // The storefront 405s a GET on every action except `schema-version`, so
  // we must guarantee POST reaches the origin (no http→https or trailing
  // slash redirect, which would downgrade POST → GET).
  const baseNorm = BASE.replace(/\/+$/, "").replace(/^http:\/\//i, "https://");
  const url = `${baseNorm}/api/public/cms/${action}`;

  const raw = JSON.stringify(body ?? {});
  const ts = Date.now().toString();
  const sig = await hmacHex(SECRET, `${ts}.${store.tenant_slug}.${raw}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      redirect: "manual", // surface redirects instead of silently GETting
      headers: {
        "Content-Type": "application/json",
        "x-platform-tenant": store.tenant_slug,
        "x-platform-timestamp": ts,
        "x-platform-signature": sig,
      },
      body: raw,
    });
  } catch (e) {
    console.error("cms-proxy fetch failed", { url, action, err: String(e) });
    return json(502, { ok: false, error: `upstream_fetch_failed: ${String(e)}` });
  }

  // If the storefront tried to redirect us, the POST would have been
  // downgraded to GET on follow. Report it loudly instead.
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    console.error("cms-proxy upstream redirect (POST would downgrade)", {
      url,
      status: res.status,
      location,
    });
    return json(502, {
      ok: false,
      error: `upstream_redirect_${res.status}_to_${location ?? "unknown"}`,
    });
  }

  const text = await res.text();
  if (!res.ok) {
    console.error("cms-proxy upstream non-2xx", {
      url,
      action,
      status: res.status,
      body: text.slice(0, 500),
    });
  }
  return new Response(text, {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
