import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { site_url, consumer_key, consumer_secret, user_id, is_sync } = await req.json();
    if (!site_url || !consumer_key || !consumer_secret) {
      return new Response(JSON.stringify({ error: "site_url, consumer_key, and consumer_secret are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch products from WooCommerce REST API
    const wcUrl = `${site_url}/wp-json/wc/v3/products?per_page=100&consumer_key=${encodeURIComponent(consumer_key)}&consumer_secret=${encodeURIComponent(consumer_secret)}`;
    const wcRes = await fetch(wcUrl);

    if (!wcRes.ok) {
      const errText = await wcRes.text();
      return new Response(JSON.stringify({ error: `WooCommerce API error (${wcRes.status}): ${errText}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const products = await wcRes.json();

    // If syncing, remove products that no longer exist in WooCommerce
    if (is_sync && user_id) {
      const { data: existing } = await supabase
        .from("inventory_products")
        .select("id, name")
        .eq("user_id", user_id);

      if (existing) {
        const wcNames = new Set(products.map((p: any) => p.name));
        const toDelete = existing.filter((e: any) => !wcNames.has(e.name));
        for (const item of toDelete) {
          await supabase.from("inventory_products").delete().eq("id", item.id);
        }
      }
    }

    let importedCount = 0;
    let updatedCount = 0;

    for (const product of products) {
      const images = product.images || [];
      const variants = (product.variations_data || product.attributes || []).map((v: any) => ({
        name: v.name || v.option,
        options: v.options || [],
      }));

      const row = {
        name: product.name,
        category: product.categories?.[0]?.name || "Other",
        description: product.short_description?.replace(/<[^>]*>/g, "") || product.description?.replace(/<[^>]*>/g, "") || null,
        base_price: parseFloat(product.price) || parseFloat(product.regular_price) || 0,
        image_front: images[0]?.src || null,
        image_back: images[1]?.src || null,
        image_side1: images[2]?.src || null,
        image_side2: images[3]?.src || null,
        variants,
        is_active: product.status === "publish",
        user_id: user_id || null,
      };

      // Check if product already exists (by name + user_id)
      if (user_id) {
        const { data: existingProduct } = await supabase
          .from("inventory_products")
          .select("id")
          .eq("user_id", user_id)
          .eq("name", product.name)
          .maybeSingle();

        if (existingProduct) {
          const { error } = await supabase
            .from("inventory_products")
            .update(row)
            .eq("id", existingProduct.id);
          if (!error) updatedCount++;
          continue;
        }
      }

      const { error } = await supabase.from("inventory_products").insert(row);
      if (!error) importedCount++;
    }

    // Update last_synced_at
    if (user_id) {
      await supabase
        .from("store_integrations")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", user_id)
        .eq("platform", "woocommerce");
    }

    return new Response(JSON.stringify({ imported_count: importedCount, updated_count: updatedCount, total: products.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
