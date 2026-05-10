import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      product,
      external_ref,
      user_id,
      customer_email,
      customer_name,
      order_notes,
      woocommerce_site_url,
      store_id: requested_store_id,
    } = await req.json();

    /** Match storefront to corporate_stores.wp_site_url (ignore scheme + leading www). */
    function siteHostKey(url: string): string {
      try {
        const u = new URL(String(url).trim());
        let host = u.hostname.toLowerCase();
        if (host.startsWith("www.")) host = host.slice(4);
        return host;
      } catch {
        return "";
      }
    }

    if (!product || !product.name) {
      return new Response(
        JSON.stringify({ error: "Product data with at least a name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let resolved_store_id: string | null = null;
    if (user_id) {
      if (requested_store_id) {
        const { data: owned } = await supabase
          .from("corporate_stores")
          .select("id")
          .eq("id", requested_store_id)
          .eq("user_id", user_id)
          .eq("status", "active")
          .maybeSingle();
        if (owned?.id) resolved_store_id = owned.id;
      }
      if (!resolved_store_id && woocommerce_site_url) {
        const target = siteHostKey(woocommerce_site_url);
        if (target) {
          const { data: stores } = await supabase
            .from("corporate_stores")
            .select("id,wp_site_url")
            .eq("user_id", user_id)
            .eq("status", "active");
          const row = stores?.find((s) => {
            if (!s.wp_site_url) return false;
            return siteHostKey(s.wp_site_url) === target;
          });
          if (row?.id) resolved_store_id = row.id;
        }
      }
    }

    const { data, error } = await supabase
      .from("customizer_sessions")
      .insert({
        product_data: product,
        external_ref: external_ref || null,
        user_id: user_id || null,
        store_id: resolved_store_id,
        customer_email: customer_email || null,
        customer_name: customer_name || null,
        order_notes: order_notes || null,
        status: "active",
      })
      .select("id")
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = Deno.env.get("CUSTOMIZER_BASE_URL") || req.headers.get("origin") || "";

    return new Response(
      JSON.stringify({
        sessionId: data.id,
        customizerUrl: `${baseUrl}/embed/${data.id}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
