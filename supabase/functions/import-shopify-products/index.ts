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
    const { store_url, access_token, user_id, is_sync } = await req.json();
    if (!store_url || !access_token) {
      return new Response(JSON.stringify({ error: "store_url and access_token are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch products from Shopify Admin API
    const shopifyUrl = `${store_url}/admin/api/2024-01/products.json?limit=250`;
    const shopifyRes = await fetch(shopifyUrl, {
      headers: { "X-Shopify-Access-Token": access_token },
    });

    if (!shopifyRes.ok) {
      const errText = await shopifyRes.text();
      return new Response(JSON.stringify({ error: `Shopify API error (${shopifyRes.status}): ${errText}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { products } = await shopifyRes.json();

    // On sync, only delete Shopify-sourced products (not all user products)
    if (is_sync && user_id) {
      const { data: existing } = await supabase
        .from("inventory_products")
        .select("id, supplier_source")
        .eq("user_id", user_id);
      
      if (existing) {
        const shopifyProductIds = existing
          .filter((p: any) => p.supplier_source?.provider === "shopify")
          .map((p: any) => p.id);
        
        if (shopifyProductIds.length > 0) {
          await supabase
            .from("inventory_products")
            .delete()
            .in("id", shopifyProductIds);
        }
      }
    }

    let importedCount = 0;

    for (const product of products) {
      const images = product.images || [];
      const variants = (product.variants || []).map((v: any) => ({
        name: v.title,
        price: parseFloat(v.price) || 0,
        sku: v.sku,
      }));

      const row = {
        name: product.title,
        category: product.product_type || "Other",
        description: product.body_html?.replace(/<[^>]*>/g, "") || null,
        base_price: parseFloat(product.variants?.[0]?.price) || 0,
        image_front: images[0]?.src || null,
        image_back: images[1]?.src || null,
        image_side1: images[2]?.src || null,
        image_side2: images[3]?.src || null,
        variants,
        is_active: product.status === "active",
        user_id: user_id || null,
        supplier_source: {
          provider: "shopify",
          shopify_product_id: String(product.id),
          external_ids: { shopify: String(product.id) },
        },
      };

      const { error } = await supabase.from("inventory_products").insert(row);
      if (!error) importedCount++;
    }

    // Update last_synced_at
    if (user_id) {
      await supabase
        .from("store_integrations")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("user_id", user_id)
        .eq("platform", "shopify");
    }

    return new Response(JSON.stringify({ imported_count: importedCount, total: products.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
