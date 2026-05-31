// TEMPORARY debug endpoint — DO NOT DELETE until user says so.
// Returns all edge-function env vars as JSON. Token is in the URL path itself.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TOKEN = "40779174228f353a03b2a7eb0a7bfa83440b79b3d28b62f5";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  if (!url.pathname.includes(TOKEN)) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(Deno.env.toObject(), null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
