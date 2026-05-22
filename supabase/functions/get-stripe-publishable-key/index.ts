// Returns the Stripe publishable key for the requested environment.
// Used by the frontend so we don't have to bake pk_live into client env vars.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const env = url.searchParams.get("env") === "sandbox" ? "sandbox" : "live";

  const pk = env === "live"
    ? Deno.env.get("STRIPE_LIVE_PUBLISHABLE_KEY")
    : Deno.env.get("STRIPE_CONNECT_PUBLISHABLE_KEY"); // fallback for sandbox preview

  if (!pk) {
    return new Response(JSON.stringify({ error: "publishable_key_not_configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ publishableKey: pk, environment: env }), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
});
