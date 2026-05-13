// One-shot reveal of SUPABASE_SERVICE_ROLE_KEY.
// Protected by REVEAL_TOKEN header. After first successful reveal,
// the row in _one_shot_reveal is marked consumed and all subsequent
// calls return 410 Gone.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-reveal-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KEY_NAME = "service_role_key";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expected = Deno.env.get("REVEAL_TOKEN");
  const provided = req.headers.get("x-reveal-token");
  if (!expected || !provided || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  // Atomic claim: only succeeds if not yet consumed.
  const { data: claim, error: claimErr } = await admin
    .from("_one_shot_reveal")
    .update({ consumed_at: new Date().toISOString() })
    .eq("key_name", KEY_NAME)
    .is("consumed_at", null)
    .select("key_name")
    .maybeSingle();

  if (claimErr) {
    return new Response(JSON.stringify({ error: claimErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!claim) {
    return new Response(
      JSON.stringify({ error: "Already consumed. Rotate keys again to re-arm." }),
      { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      supabase_url: url,
      service_role_key: serviceKey,
      anon_key: Deno.env.get("SUPABASE_ANON_KEY"),
      warning: "Copy now. This endpoint is now disabled.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
