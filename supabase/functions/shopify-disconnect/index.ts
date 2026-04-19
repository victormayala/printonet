import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Shopify Disconnect:
 *  - Removes the registered ScriptTag from the merchant's storefront so we don't leave
 *    orphan scripts loading on their store.
 *  - Deletes the store_integrations row.
 *
 * Expects JSON body: { user_id: "uuid" }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the integration
    const { data: integration } = await supabase
      .from("store_integrations")
      .select("id, store_url, credentials, script_tag_id")
      .eq("user_id", user_id)
      .eq("platform", "shopify")
      .maybeSingle();

    if (!integration) {
      return new Response(JSON.stringify({ ok: true, message: "No integration found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = (integration.credentials as any)?.access_token;
    const shop = (integration.store_url || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const scriptTagId = (integration as any).script_tag_id;

    // Best-effort: remove the ScriptTag from Shopify
    if (accessToken && shop && scriptTagId) {
      try {
        const delRes = await fetch(
          `https://${shop}/admin/api/2025-01/script_tags/${scriptTagId}.json`,
          {
            method: "DELETE",
            headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
          }
        );
        if (!delRes.ok) {
          const t = await delRes.text();
          console.warn("ScriptTag delete returned non-OK:", t);
        }
      } catch (e) {
        console.warn("ScriptTag delete failed:", e);
      }
    }

    // Remove the integration row
    await supabase.from("store_integrations").delete().eq("id", integration.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("shopify-disconnect error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
