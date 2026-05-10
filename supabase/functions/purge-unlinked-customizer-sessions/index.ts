import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-printonet-purge-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const purgeSecret = Deno.env.get("PURGE_SESSIONS_SECRET");

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerSecret = req.headers.get("x-printonet-purge-secret") || "";

  const okBearer = bearer && bearer === serviceRoleKey;
  const okSecret = purgeSecret && headerSecret && headerSecret === purgeSecret;

  if (!okBearer && !okSecret) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let days = 30;
  try {
    const text = await req.text();
    if (text) {
      const body = JSON.parse(text);
      if (typeof body?.days === "number" && Number.isFinite(body.days)) {
        days = Math.floor(body.days);
      }
    }
  } catch {
    // ignore body parse errors, default to 30
  }

  if (days < 7) {
    return new Response(
      JSON.stringify({ ok: false, error: "days must be >= 7", days }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);

  const { data, error } = await supabase.rpc(
    "printonet_purge_unlinked_customizer_sessions",
    { p_days: days }
  );

  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message, days }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, deleted_count: Number(data) || 0, days }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
