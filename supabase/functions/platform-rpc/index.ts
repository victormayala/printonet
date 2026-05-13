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

      default:
        return json(400, { error: "unknown_op", op });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(500, { error: "rpc_failed", message });
  }
});
