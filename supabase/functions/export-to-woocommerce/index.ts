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
    const { product_ids, site_url, consumer_key, consumer_secret, user_id } = await req.json();

    if (!product_ids?.length || !site_url || !consumer_key || !consumer_secret) {
      return new Response(JSON.stringify({ error: "product_ids, site_url, consumer_key, and consumer_secret are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: products, error: fetchErr } = await supabase
      .from("inventory_products")
      .select("*")
      .in("id", product_ids);

    if (fetchErr) throw fetchErr;
    if (!products?.length) {
      return new Response(JSON.stringify({ error: "No products found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = site_url.replace(/\/$/, "");
    const authHeader = "Basic " + btoa(`${consumer_key}:${consumer_secret}`);
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        const supplierSource = product.supplier_source || {};
        const existingWcId = supplierSource?.external_ids?.woocommerce;

        const images: { src: string }[] = [];
        if (product.image_front) images.push({ src: product.image_front });
        if (product.image_back) images.push({ src: product.image_back });
        if (product.image_side1) images.push({ src: product.image_side1 });
        if (product.image_side2) images.push({ src: product.image_side2 });

        const variants = Array.isArray(product.variants) ? product.variants : [];
        const hasVariants = variants.length > 0;

        // Build attributes from variants
        const colorNames = [...new Set(variants.map((v: any) => v.color || v.colorName).filter(Boolean))];
        const allSizes = [...new Set(variants.flatMap((v: any) => (v.sizes || []).map((s: any) => s.size)).filter(Boolean))];

        const attributes: any[] = [];
        if (colorNames.length > 0) {
          attributes.push({ name: "Color", visible: true, variation: true, options: colorNames });
        }
        if (allSizes.length > 0) {
          attributes.push({ name: "Size", visible: true, variation: true, options: allSizes });
        }

        const wcProduct: any = {
          name: product.name,
          type: hasVariants && attributes.length > 0 ? "variable" : "simple",
          description: product.description || "",
          regular_price: hasVariants ? undefined : String(product.base_price),
          images,
          categories: [{ name: product.category }],
          attributes,
        };

        let wcProductId: number;

        if (existingWcId) {
          // Update existing
          const res = await fetch(`${baseUrl}/wp-json/wc/v3/products/${existingWcId}`, {
            method: "PUT",
            headers: { Authorization: authHeader, "Content-Type": "application/json" },
            body: JSON.stringify(wcProduct),
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Update failed (${res.status}): ${errText}`);
          }
          wcProductId = existingWcId;
          updated++;
        } else {
          // Create new
          const res = await fetch(`${baseUrl}/wp-json/wc/v3/products`, {
            method: "POST",
            headers: { Authorization: authHeader, "Content-Type": "application/json" },
            body: JSON.stringify(wcProduct),
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Create failed (${res.status}): ${errText}`);
          }
          const wcData = await res.json();
          wcProductId = wcData.id;
          created++;
        }

        // Create variations for variable products
        if (hasVariants && attributes.length > 0 && !existingWcId) {
          for (const variant of variants) {
            const colorName = variant.color || variant.colorName || "";
            const sizes = variant.sizes || [];
            for (const size of sizes) {
              const variation: any = {
                regular_price: String(size.price || product.base_price),
                attributes: [],
              };
              if (colorName) variation.attributes.push({ name: "Color", option: colorName });
              if (size.size) variation.attributes.push({ name: "Size", option: size.size });

              await fetch(`${baseUrl}/wp-json/wc/v3/products/${wcProductId}/variations`, {
                method: "POST",
                headers: { Authorization: authHeader, "Content-Type": "application/json" },
                body: JSON.stringify(variation),
              });
            }
          }
        }

        // Store the WC product ID back
        const newSupplierSource = {
          ...supplierSource,
          external_ids: { ...(supplierSource.external_ids || {}), woocommerce: wcProductId },
        };
        await supabase
          .from("inventory_products")
          .update({ supplier_source: newSupplierSource })
          .eq("id", product.id);

      } catch (err: any) {
        failed++;
        errors.push(`${product.name}: ${err.message}`);
      }
    }

    return new Response(JSON.stringify({ created, updated, failed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
