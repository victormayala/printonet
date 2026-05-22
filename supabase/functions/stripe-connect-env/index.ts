// Returns the Stripe Connect environment (test/live) detected from the
// configured STRIPE_CONNECT_SECRET_KEY prefix. Restricted to super_admin.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("STRIPE_CONNECT_SECRET_KEY") || "";
const PUBLISHABLE = Deno.env.get("STRIPE_CONNECT_PUBLISHABLE_KEY") || "";
const WEBHOOK = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (error || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: claims.claims.sub,
      _role: "super_admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mode: "test" | "live" | "unset" = SECRET.startsWith("sk_live_")
      ? "live"
      : SECRET.startsWith("sk_test_")
      ? "test"
      : "unset";

    return new Response(
      JSON.stringify({
        mode,
        secret_configured: !!SECRET,
        publishable_configured: !!PUBLISHABLE,
        publishable_mode: PUBLISHABLE.startsWith("pk_live_")
          ? "live"
          : PUBLISHABLE.startsWith("pk_test_")
          ? "test"
          : "unset",
        webhook_configured: !!WEBHOOK,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
