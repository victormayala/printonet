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
    const { product_ids, store_url, access_token, user_id } = await req.json();

    if (!product_ids?.length || !store_url || !access_token) {
      return new Response(JSON.stringify({ error: "product_ids, store_url, and access_token are required" }), {
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

    const baseUrl = store_url.replace(/\/$/, "");
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        const supplierSource = product.supplier_source || {};
        const existingShopifyId = supplierSource?.external_ids?.shopify;

        // Main product images (front, back, sides) + variant color images
        const images: { src: string; alt?: string }[] = [];
        if (product.image_front) images.push({ src: product.image_front, alt: `${product.name} - Front` });
        if (product.image_back) images.push({ src: product.image_back, alt: `${product.name} - Back` });
        if (product.image_side1) images.push({ src: product.image_side1, alt: `${product.name} - Side` });
        if (product.image_side2) images.push({ src: product.image_side2, alt: `${product.name} - Side 2` });

        const variants = Array.isArray(product.variants) ? product.variants : [];

        // Add variant color images to the product images list
        // Track position index for each variant image so we can link variants to images
        const variantImagePositions: Map<string, number> = new Map();
        for (const variant of variants) {
          const varImg = variant.image || variant.colorFrontImage;
          if (varImg && !images.some((img) => img.src === varImg)) {
            const colorName = variant.color || variant.colorName || "";
            variantImagePositions.set(varImg, images.length + 1); // Shopify positions are 1-based
            images.push({ src: varImg, alt: `${product.name} - ${colorName}` });
          } else if (varImg) {
            // Image already exists, just record its position
            const idx = images.findIndex((img) => img.src === varImg);
            if (idx >= 0) variantImagePositions.set(varImg, idx + 1);
          }
        }

        // Build Shopify options and variants
        const colorNames = [...new Set(variants.map((v: any) => v.color || v.colorName).filter(Boolean))];
        const allSizes = [...new Set(variants.flatMap((v: any) => (v.sizes || []).map((s: any) => s.size)).filter(Boolean))];

        const options: { name: string; values: string[] }[] = [];
        if (colorNames.length > 0) options.push({ name: "Color", values: colorNames });
        if (allSizes.length > 0) options.push({ name: "Size", values: allSizes });

        // Build color hex map for metafields
        const colorHexMap: Record<string, string> = {};
        for (const v of variants) {
          const cName = v.color || v.colorName || "";
          const hex = v.hexColor || v.hex || v.colorHex || "";
          if (cName && hex) colorHexMap[cName] = hex;
        }

        // Build flat variant list for Shopify
        const shopifyVariants: any[] = [];
        if (variants.length > 0 && options.length > 0) {
          for (const variant of variants) {
            const colorName = variant.color || variant.colorName || "";
            const hexColor = variant.hexColor || variant.hex || variant.colorHex || "";
            const sizes = variant.sizes || [];
            if (sizes.length > 0) {
              for (const size of sizes) {
                const sv: any = {
                  price: String(size.price || product.base_price),
                  sku: size.sku || undefined,
                };
                if (colorNames.length > 0) sv.option1 = colorName;
                if (allSizes.length > 0) sv.option2 = size.size;
                shopifyVariants.push(sv);
              }
            } else {
              const sv: any = { price: String(product.base_price) };
              if (colorNames.length > 0) sv.option1 = colorName;
              shopifyVariants.push(sv);
            }
          }
        }

        if (shopifyVariants.length === 0) {
          shopifyVariants.push({ price: String(product.base_price) });
        }

        // Build metafields for color swatches
        const metafields: any[] = [];
        if (Object.keys(colorHexMap).length > 0) {
          metafields.push({
            namespace: "customizer_studio",
            key: "color_hex_map",
            value: JSON.stringify(colorHexMap),
            type: "json",
          });
        }

        const shopifyProduct: any = {
          product: {
            title: product.name,
            body_html: product.description || "",
            product_type: product.category,
            images,
            options: options.length > 0 ? options : undefined,
            variants: shopifyVariants,
            metafields: metafields.length > 0 ? metafields : undefined,
          },
        };

        let shopifyProductId: string;

        if (existingShopifyId) {
          const res = await fetch(`${baseUrl}/admin/api/2024-01/products/${existingShopifyId}.json`, {
            method: "PUT",
            headers: {
              "X-Shopify-Access-Token": access_token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(shopifyProduct),
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Update failed (${res.status}): ${errText}`);
          }
          const shopData = await res.json();
          shopifyProductId = existingShopifyId;
          updated++;

          // After update, assign variant images by matching color → image
          await assignShopifyVariantImages(baseUrl, access_token, shopifyProductId, shopData.product, variants);
        } else {
          const res = await fetch(`${baseUrl}/admin/api/2024-01/products.json`, {
            method: "POST",
            headers: {
              "X-Shopify-Access-Token": access_token,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(shopifyProduct),
          });
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Create failed (${res.status}): ${errText}`);
          }
          const shopData = await res.json();
          shopifyProductId = String(shopData.product.id);
          created++;

          // After creation, assign variant images by matching color → image
          await assignShopifyVariantImages(baseUrl, access_token, shopifyProductId, shopData.product, variants);
        }

        // Store the Shopify product ID back
        const newSupplierSource = {
          ...supplierSource,
          external_ids: { ...(supplierSource.external_ids || {}), shopify: shopifyProductId },
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

/**
 * After creating/updating a Shopify product, match each variant to its color image
 * and update the variant's image_id so Shopify shows the right image per colorway.
 */
async function assignShopifyVariantImages(
  baseUrl: string,
  accessToken: string,
  productId: string,
  shopProduct: any,
  localVariants: any[]
) {
  const shopImages: { id: number; src: string; alt?: string }[] = shopProduct?.images || [];
  const shopVariants: { id: number; option1?: string; option2?: string; image_id?: number }[] = shopProduct?.variants || [];

  if (!shopImages.length || !shopVariants.length || !localVariants.length) return;

  // Build a map: color image URL filename → Shopify image ID
  const imgFileToId: Record<string, number> = {};
  for (const img of shopImages) {
    if (img.src && img.id) {
      const filename = img.src.split("/").pop()?.split("?")[0] || "";
      if (filename) imgFileToId[filename] = img.id;
      imgFileToId[img.src] = img.id;
    }
  }

  // Build a map: colorName → variant image URL
  const colorToImgUrl: Record<string, string> = {};
  for (const v of localVariants) {
    const color = (v.color || v.colorName || "").toLowerCase();
    const img = v.image || v.colorFrontImage;
    if (color && img) colorToImgUrl[color] = img;
  }

  // For each Shopify variant, if its color has a matching image, update image_id
  for (const sv of shopVariants) {
    const color = (sv.option1 || "").toLowerCase();
    const imgUrl = colorToImgUrl[color];
    if (!imgUrl) continue;

    const filename = imgUrl.split("/").pop()?.split("?")[0] || "";
    const imageId = imgFileToId[filename] || imgFileToId[imgUrl];
    if (!imageId || sv.image_id === imageId) continue;

    // Update variant with the correct image_id
    try {
      await fetch(`${baseUrl}/admin/api/2024-01/variants/${sv.id}.json`, {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ variant: { id: sv.id, image_id: imageId } }),
      });
    } catch {
      // Non-critical, skip silently
    }
  }
}
