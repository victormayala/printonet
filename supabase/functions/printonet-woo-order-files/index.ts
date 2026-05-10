// Receives paid Woo order payloads from tenant stores (WordPress) and stores
// them so the Printonet dashboard can render print files for fulfillment.
//
// Auth: HMAC-SHA256 signed by WordPress using PRINTONET_PLATFORM_HMAC_SECRET.
//   Headers:
//     X-Printonet-Timestamp: <unix_seconds>
//     X-Printonet-Signature: hex( HMAC-SHA256( `${timestamp}.${rawBody}`, secret ) )
//
// Deployed with verify_jwt = false (configured in supabase/config.toml).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-printonet-timestamp, x-printonet-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_SKEW_SECONDS = 300;

async function hexHmacSha256(secret: string, message: string): Promise<string> {
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

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
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

  const secret = Deno.env.get("PRINTONET_PLATFORM_HMAC_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !supabaseUrl || !serviceRole) {
    return new Response(
      JSON.stringify({ error: "server_misconfigured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const ts = req.headers.get("x-printonet-timestamp") ?? "";
  const sig = req.headers.get("x-printonet-signature") ?? "";
  const rawBody = await req.text();

  if (!ts || !sig) {
    return new Response(JSON.stringify({ error: "missing_signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > MAX_SKEW_SECONDS) {
    return new Response(JSON.stringify({ error: "stale_timestamp" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const expected = await hexHmacSha256(secret, `${ts}.${rawBody}`);
  if (!timingSafeEqualHex(expected, sig.toLowerCase())) {
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tenant_slug = String(body?.tenant_slug ?? "").trim();
  const store_url = String(body?.store_url ?? "").trim();
  const order_id = Number(body?.order_id);
  if (!tenant_slug || !store_url || !Number.isFinite(order_id)) {
    return new Response(
      JSON.stringify({ error: "missing_required_fields" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const row = {
    tenant_slug,
    store_url,
    order_id,
    order_number: body?.order_number ? String(body.order_number) : null,
    order_status: body?.order_status ? String(body.order_status) : null,
    currency: body?.currency ? String(body.currency) : null,
    date_paid: body?.date_paid ? new Date(body.date_paid).toISOString() : null,
    line_items: Array.isArray(body?.line_items) ? body.line_items : [],
    payload: body ?? {},
    updated_at: new Date().toISOString(),
  };

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });

  const { error } = await supabase
    .from("printonet_woo_order_files")
    .upsert(row, { onConflict: "tenant_slug,store_url,order_id" });

  if (error) {
    console.error("upsert_failed", error);
    return new Response(
      JSON.stringify({ error: "upsert_failed", detail: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
