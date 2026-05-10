/**
 * Daily cleanup: delete customizer_sessions older than 30 days that are not
 * referenced on any printonet_woo_order_files line item (paid-order sync).
 *
 * Schedule (Supabase Dashboard → Edge Functions → Schedules) or external cron:
 *   POST /functions/v1/purge-unlinked-customizer-sessions
 *   Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *   Optional body: { "days": 30 }
 *
 * Alternatively set secret-only mode:
 *   Header: x-printonet-purge-secret: <PURGE_SESSIONS_SECRET>
 * (If PURGE_SESSIONS_SECRET is set in Edge secrets, Bearer SRK is not required.)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-printonet-purge-secret",
};

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

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const purgeSecret = Deno.env.get("PURGE_SESSIONS_SECRET") ?? "";

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
  const headerSecret = req.headers.get("x-printonet-purge-secret") ?? "";

  const okService = serviceKey !== "" && bearer === serviceKey;
  const okSecret = purgeSecret !== "" && headerSecret === purgeSecret;
  if (!okService && !okSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let days = 30;
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.days === "number" && Number.isFinite(body.days)) {
      days = Math.floor(body.days);
    }
  } catch {
    /* default days */
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase.rpc("printonet_purge_unlinked_customizer_sessions", {
    p_days: days,
  });

  if (error) {
    console.error("purge-unlinked-customizer-sessions", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const deleted = typeof data === "number" ? data : Number(data);
  return new Response(JSON.stringify({ ok: true, deleted_count: deleted, days }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
