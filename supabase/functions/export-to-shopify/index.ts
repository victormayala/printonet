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

        const images: { src: string }[] = [];
        if (product.image_front) images.push({ src: product.image_front });
        if (product.image_back) images.push({ src: product.image_back });
        if (product.image_side1) images.push({ src: product.image_side1 });
        if (product.image_side2) images.push({ src: product.image_side2 });

        const variants = Array.isArray(product.variants) ? product.variants : [];

        // Build Shopify options and variants
        const colorNames = [...new Set(variants.map((v: any) => v.color || v.colorName).filter(Boolean))];
        const allSizes = [...new Set(variants.flatMap((v: any) => (v.sizes || []).map((s: any) => s.size)).filter(Boolean))];

        const options: { name: string; values: string[] }[] = [];
        if (colorNames.length > 0) options.push({ name: "Color", values: colorNames });
        if (allSizes.length > 0) options.push({ name: "Size", values: allSizes });

        // Build flat variant list for Shopify
        const shopifyVariants: any[] = [];
        if (variants.length > 0 && options.length > 0) {
          for (const variant of variants) {
            const colorName = variant.color || variant.colorName || "";
            const sizes = variant.sizes || [];
            if (sizes.length > 0) {
              for (const size of sizes) {
                const sv: any = { price: String(size.price || product.base_price) };
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

        const shopifyProduct: any = {
          product: {
            title: product.name,
            body_html: product.description || "",
            product_type: product.category,
            images,
            options: options.length > 0 ? options : undefined,
            variants: shopifyVariants,
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
          shopifyProductId = existingShopifyId;
          updated++;
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
