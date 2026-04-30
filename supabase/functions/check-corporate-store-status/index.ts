// Lightweight status check for a corporate store.
// On the WordPress Multisite platform, provisioning is synchronous, so this
// function mostly just returns the current DB row. For rows still marked as
// "provisioning" (e.g. a previous failed attempt), it pings the tenant site's
// /printonet/v1/health endpoint and flips to "active" once it responds.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  store_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store } = await admin
      .from("corporate_stores")
      .select("*")
      .eq("id", parsed.data.store_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!store) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anything other than "provisioning" → just return.
    if (store.status !== "provisioning") {
      return new Response(JSON.stringify({ store }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If we have a site URL, ping its health endpoint to flip to active.
    if (store.wp_site_url) {
      const healthUrl = `${store.wp_site_url.replace(/\/$/, "")}/wp-json/printonet/v1/health`;
      try {
        const hr = await fetch(healthUrl, { headers: { Accept: "application/json" } });
        if (hr.ok) {
          const hj = await hr.json().catch(() => null);
          if (hj?.ok) {
            await admin
              .from("corporate_stores")
              .update({ status: "active", error_message: null })
              .eq("id", store.id);
            const { data: refreshed } = await admin
              .from("corporate_stores")
              .select("*")
              .eq("id", store.id)
              .single();
            return new Response(JSON.stringify({ store: refreshed }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (e) {
        console.log("health check failed", e);
      }
    }

    return new Response(JSON.stringify({ store }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-corporate-store-status error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
