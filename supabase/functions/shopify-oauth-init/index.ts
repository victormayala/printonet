import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Shopify OAuth Step 1: Redirect the user to Shopify's authorization page.
 * 
 * Expects JSON body:
 *   { shop: "my-store.myshopify.com", user_id: "uuid", redirect_url: "https://..." }
 * 
 * Returns JSON:
 *   { authorization_url: "https://my-store.myshopify.com/admin/oauth/authorize?..." }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shop, user_id, redirect_url } = await req.json();

    if (!shop || !user_id) {
      return new Response(JSON.stringify({ error: "shop and user_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("SHOPIFY_API_KEY");
    if (!clientId) {
      return new Response(JSON.stringify({ error: "Shopify API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/shopify-oauth-callback`;

    // Normalize shop domain
    let shopDomain = shop.trim().toLowerCase();
    shopDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!shopDomain.includes(".")) {
      shopDomain = `${shopDomain}.myshopify.com`;
    }

    // Generate a nonce/state to prevent CSRF — encode user_id + redirect_url
    const state = btoa(JSON.stringify({
      user_id,
      redirect_url: redirect_url || "",
      nonce: crypto.randomUUID(),
    }));

    const scopes = "read_products,write_products,read_inventory,write_inventory,read_publications,write_publications,write_script_tags,read_script_tags";
    const authUrl = `https://${shopDomain}/admin/oauth/authorize?` +
      `client_id=${clientId}` +
      `&scope=${scopes}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
      `&state=${encodeURIComponent(state)}`;

    return new Response(JSON.stringify({ authorization_url: authUrl, shop: shopDomain }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
