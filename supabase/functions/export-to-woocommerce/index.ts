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

        // Main product images (front, back, sides)
        const images: { src: string }[] = [];
        if (product.image_front) images.push({ src: product.image_front });
        if (product.image_back) images.push({ src: product.image_back });
        if (product.image_side1) images.push({ src: product.image_side1 });
        if (product.image_side2) images.push({ src: product.image_side2 });

        const variants = Array.isArray(product.variants) ? product.variants : [];
        const hasVariants = variants.length > 0;

        // Add variant color images to the product-level images gallery
        // WooCommerce variations reference images by ID from the parent product's gallery
        for (const variant of variants) {
          const varImg = variant.image || variant.colorFrontImage;
          if (varImg && !images.some((img) => img.src === varImg)) {
            images.push({ src: varImg });
          }
        }

        // Build attributes from variants
        const colorNames = [...new Set(variants.map((v: any) => v.color || v.colorName).filter(Boolean))];
        const allSizes = [...new Set(variants.flatMap((v: any) => (v.sizes || []).map((s: any) => s.size)).filter(Boolean))];

        // Build a color-to-hex map for the product-level default_attributes metadata
        const colorHexMap: Record<string, string> = {};
        for (const v of variants) {
          const cName = v.color || v.colorName || "";
          const hex = v.hexColor || v.hex || v.colorHex || "";
          if (cName && hex) colorHexMap[cName] = hex;
        }

        const attributes: any[] = [];
        if (colorNames.length > 0) {
          attributes.push({ name: "Color", visible: true, variation: true, options: colorNames });
        }
        if (allSizes.length > 0) {
          attributes.push({ name: "Size", visible: true, variation: true, options: allSizes });
        }

        // Store color hex map as product-level metadata for swatch plugins
        const productMeta: any[] = [];
        if (Object.keys(colorHexMap).length > 0) {
          productMeta.push({ key: "_color_hex_map", value: JSON.stringify(colorHexMap) });
          // Common swatch plugin format: individual entries per color
          for (const [name, hex] of Object.entries(colorHexMap)) {
            productMeta.push({ key: `_color_${name.toLowerCase().replace(/\s+/g, '_')}`, value: hex });
          }
        }

        const wcProduct: any = {
          name: product.name,
          type: hasVariants && attributes.length > 0 ? "variable" : "simple",
          description: product.description || "",
          regular_price: hasVariants ? undefined : String(product.base_price),
          images,
          categories: [{ name: product.category }],
          attributes,
          meta_data: productMeta.length > 0 ? productMeta : undefined,
        };

        let wcProductId: number;
        let wcProductImages: { id: number; src: string }[] = [];

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
          const wcData = await res.json();
          wcProductId = existingWcId;
          wcProductImages = wcData.images || [];
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
          wcProductImages = wcData.images || [];
          created++;
        }

        // Build a map of image URL → WC image ID for variation image assignment
        const imageUrlToId: Record<string, number> = {};
        for (const img of wcProductImages) {
          if (img.src && img.id) {
            // WC may modify the URL (add host, resize suffix), so match by the last path segment
            const srcKey = img.src.split("/").pop()?.split("?")[0] || img.src;
            imageUrlToId[srcKey] = img.id;
            // Also store the full src for exact matching
            imageUrlToId[img.src] = img.id;
          }
        }

        // Helper to find the WC image ID for a variant image URL
        function findImageId(url: string): number | undefined {
          if (imageUrlToId[url]) return imageUrlToId[url];
          const key = url.split("/").pop()?.split("?")[0] || url;
          return imageUrlToId[key];
        }

        // Create or update variations for variable products
        if (hasVariants && attributes.length > 0) {
          // If updating, delete existing variations first to avoid duplicates
          if (existingWcId) {
            try {
              const varRes = await fetch(`${baseUrl}/wp-json/wc/v3/products/${wcProductId}/variations?per_page=100`, {
                headers: { Authorization: authHeader },
              });
              if (varRes.ok) {
                const existingVars = await varRes.json();
                for (const ev of existingVars) {
                  await fetch(`${baseUrl}/wp-json/wc/v3/products/${wcProductId}/variations/${ev.id}?force=true`, {
                    method: "DELETE",
                    headers: { Authorization: authHeader },
                  });
                }
              }
            } catch {
              // Non-critical, continue with creation
            }
          }

          for (const variant of variants) {
            const colorName = variant.color || variant.colorName || "";
            const variantImg = variant.image || variant.colorFrontImage;
            const sizes = variant.sizes || [];

            for (const size of sizes) {
              const variation: any = {
                regular_price: String(size.price || product.base_price),
                attributes: [],
                meta_data: [],
              };
              if (colorName) variation.attributes.push({ name: "Color", option: colorName });
              if (size.size) variation.attributes.push({ name: "Size", option: size.size });

              // Push hex color code as metadata for color swatch plugins
              const hexColor = variant.hexColor || variant.hex || variant.colorHex || "";
              if (hexColor) {
                variation.meta_data.push(
                  { key: "_color_hex", value: hexColor },
                  { key: "attribute_pa_color", value: hexColor },
                  { key: "_variation_color", value: hexColor }
                );
              }

              // Attach color-specific image to the variation
              if (variantImg) {
                const wcImgId = findImageId(variantImg);
                if (wcImgId) {
                  variation.image = { id: wcImgId };
                } else {
                  variation.image = { src: variantImg };
                }
              }

              // Add SKU from size data if available
              if (size.sku) {
                variation.sku = size.sku;
              }

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
