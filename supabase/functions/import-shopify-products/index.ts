import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_API_VERSION = "2025-01";

const PRODUCTS_QUERY = `
  query ($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        node {
          id
          title
          descriptionHtml
          productType
          status
          images(first: 10) {
            edges {
              node {
                url
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                title
                price
                sku
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

async function fetchAllProducts(storeUrl: string, accessToken: string) {
  const baseUrl = storeUrl.replace(/\/$/, "");
  const allProducts: any[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await fetch(
      `${baseUrl}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { cursor } }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Shopify API error (${res.status}): ${errText}`);
    }

    const json = await res.json();

    if (json.errors) {
      throw new Error(`Shopify GraphQL error: ${JSON.stringify(json.errors)}`);
    }

    const { edges, pageInfo } = json.data.products;
    for (const edge of edges) {
      allProducts.push(edge.node);
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return allProducts;
}

// Extract numeric ID from Shopify GID (e.g. "gid://shopify/Product/12345" → "12345")
function extractGid(gid: string): string {
  return gid.split("/").pop() || gid;
}

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

    // Fetch products via GraphQL Admin API
    const products = await fetchAllProducts(store_url, access_token);

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
      const images = product.images?.edges?.map((e: any) => e.node.url) || [];
      const variants = (product.variants?.edges || []).map((e: any) => ({
        name: e.node.title,
        price: parseFloat(e.node.price) || 0,
        sku: e.node.sku,
      }));

      const shopifyId = extractGid(product.id);

      const row = {
        name: product.title,
        category: product.productType || "Other",
        description: product.descriptionHtml?.replace(/<[^>]*>/g, "") || null,
        base_price: parseFloat(product.variants?.edges?.[0]?.node?.price) || 0,
        image_front: images[0] || null,
        image_back: images[1] || null,
        image_side1: images[2] || null,
        image_side2: images[3] || null,
        variants,
        is_active: product.status === "ACTIVE",
        user_id: user_id || null,
        supplier_source: {
          provider: "shopify",
          shopify_product_id: shopifyId,
          external_ids: { shopify: shopifyId },
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
