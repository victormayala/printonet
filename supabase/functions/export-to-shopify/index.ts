import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_API_VERSION = "2025-01";

// Query to find the Online Store publication
const GET_PUBLICATIONS_QUERY = `
  query {
    publications(first: 20) {
      edges {
        node {
          id
          name
          supportsFuturePublishing
        }
      }
    }
  }
`;

// Mutation to publish a product to sales channels
const PUBLISHABLE_PUBLISH_MUTATION = `
  mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable { ... on Product { id title } }
      userErrors { field message }
    }
  }
`;

// Mutation to update inventory item (disable tracking = infinite inventory)
const INVENTORY_ITEM_UPDATE_MUTATION = `
  mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
    inventoryItemUpdate(id: $id, input: $input) {
      inventoryItem { id tracked }
      userErrors { field message }
    }
  }
`;

// Query to get variant inventory items for a product
const GET_PRODUCT_VARIANTS_INVENTORY_QUERY = `
  query getProductVariants($id: ID!) {
    product(id: $id) {
      variants(first: 100) {
        edges {
          node {
            id
            inventoryItem {
              id
              tracked
            }
          }
        }
      }
    }
  }
`;

// GraphQL mutation to create a product (uses ProductCreateInput in 2025-01+)
const CREATE_PRODUCT_MUTATION = `
  mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product {
        id
        title
        variants(first: 100) {
          edges {
            node {
              id
              title
              selectedOptions {
                name
                value
              }
            }
          }
        }
        media(first: 20) {
          edges {
            node {
              ... on MediaImage {
                id
                image {
                  url
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL mutation to update a product
const UPDATE_PRODUCT_MUTATION = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        title
        variants(first: 100) {
          edges {
            node {
              id
              title
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL mutation to bulk create variants with pricing
const VARIANTS_BULK_CREATE_MUTATION = `
  mutation productVariantsBulkCreate($productId: ID!, $strategy: ProductVariantsBulkCreateStrategy, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkCreate(productId: $productId, strategy: $strategy, variants: $variants) {
      product { id }
      productVariants {
        id
        title
        price
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL mutation to bulk update existing variants (for price updates on existing products)
const VARIANTS_BULK_UPDATE_MUTATION = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product { id }
      productVariants {
        id
        title
        price
      }
      userErrors {
        field
        message
      }
    }
  }
`;

async function shopifyGraphQL(storeUrl: string, accessToken: string, query: string, variables: any) {
  const baseUrl = storeUrl.replace(/\/$/, "");
  const res = await fetch(
    `${baseUrl}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
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

  return json.data;
}

function extractGid(gid: string): string {
  return gid.split("/").pop() || gid;
}

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

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        const supplierSource = product.supplier_source || {};
        const existingShopifyId = supplierSource?.external_ids?.shopify;
        const existingGid = existingShopifyId ? `gid://shopify/Product/${existingShopifyId}` : null;

        const variants = Array.isArray(product.variants) ? product.variants : [];

        // Build options with values
        const colorNames = [...new Set(variants.map((v: any) => v.color || v.colorName).filter(Boolean))];
        const allSizes = [...new Set(variants.flatMap((v: any) => (v.sizes || []).map((s: any) => s.size)).filter(Boolean))];

        const productOptions: { name: string; values: { name: string }[] }[] = [];
        if (colorNames.length > 0) productOptions.push({ name: "Color", values: colorNames.map(n => ({ name: n })) });
        if (allSizes.length > 0) productOptions.push({ name: "Size", values: allSizes.map(n => ({ name: n })) });

        // Build media (images) for product creation
        const mediaInputs: { originalSource: string; alt: string; mediaContentType: string }[] = [];
        if (product.image_front) mediaInputs.push({ originalSource: product.image_front, alt: `${product.name} - Front`, mediaContentType: "IMAGE" });
        if (product.image_back) mediaInputs.push({ originalSource: product.image_back, alt: `${product.name} - Back`, mediaContentType: "IMAGE" });
        if (product.image_side1) mediaInputs.push({ originalSource: product.image_side1, alt: `${product.name} - Side`, mediaContentType: "IMAGE" });
        if (product.image_side2) mediaInputs.push({ originalSource: product.image_side2, alt: `${product.name} - Side 2`, mediaContentType: "IMAGE" });

        // Add variant-specific images
        for (const variant of variants) {
          const varImg = variant.image || variant.colorFrontImage;
          if (varImg && !mediaInputs.some((m) => m.originalSource === varImg)) {
            const colorName = variant.color || variant.colorName || "";
            mediaInputs.push({ originalSource: varImg, alt: `${product.name} - ${colorName}`, mediaContentType: "IMAGE" });
          }
        }

        let shopifyProductId: string;
        let shopifyProductGid: string;

        if (existingGid) {
          // Update existing product
          const productInput: any = {
            id: existingGid,
            title: product.name,
            descriptionHtml: product.description || "",
            productType: product.category,
            status: "ACTIVE",
          };

          const data = await shopifyGraphQL(store_url, access_token, UPDATE_PRODUCT_MUTATION, {
            input: productInput,
          });

          const userErrors = data.productUpdate?.userErrors || [];
          if (userErrors.length > 0) {
            throw new Error(userErrors.map((e: any) => e.message).join(", "));
          }

          shopifyProductId = existingShopifyId;
          shopifyProductGid = existingGid;

          // Sync variants: update existing prices + create any missing variants
          const existingVariants = data.productUpdate?.product?.variants?.edges || [];
          console.log(`[${product.name}] Existing Shopify variants: ${existingVariants.length}, local variants: ${variants.length}`);

          if (variants.length > 0) {
            // Build full set of expected variants
            const bulkVariants = buildBulkVariants(variants, product.base_price);
            
            // Build lookup of existing variant option keys
            const existingKeys = new Set(existingVariants.map((edge: any) => {
              const opts = edge.node.selectedOptions || [];
              return opts.map((o: any) => `${o.name}:${o.value}`).sort().join("|");
            }));

            // Split into updates (existing) and creates (missing)
            const variantUpdates = buildVariantPriceUpdates(existingVariants, variants, product.base_price);
            const missingVariants = bulkVariants.filter((bv: any) => {
              const key = (bv.optionValues || []).map((ov: any) => `${ov.optionName}:${ov.name}`).sort().join("|");
              return !existingKeys.has(key);
            });

            console.log(`[${product.name}] Variant updates: ${variantUpdates.length}, missing to create: ${missingVariants.length}`);

            // Update existing variant prices
            if (variantUpdates.length > 0) {
              const varData = await shopifyGraphQL(store_url, access_token, VARIANTS_BULK_UPDATE_MUTATION, {
                productId: shopifyProductGid,
                variants: variantUpdates,
              });
              const varErrors = varData.productVariantsBulkUpdate?.userErrors || [];
              if (varErrors.length > 0) {
                console.warn(`Variant update warnings for ${product.name}: ${JSON.stringify(varErrors)}`);
              }
            }

            // Create missing variants
            if (missingVariants.length > 0) {
              const varData = await shopifyGraphQL(store_url, access_token, VARIANTS_BULK_CREATE_MUTATION, {
                productId: shopifyProductGid,
                strategy: "REMOVE_STANDALONE_VARIANT",
                variants: missingVariants,
              });
              const varErrors = varData.productVariantsBulkCreate?.userErrors || [];
              if (varErrors.length > 0) {
                console.warn(`Variant creation warnings for ${product.name}: ${JSON.stringify(varErrors)}`);
              }
              console.log(`[${product.name}] Created ${varData.productVariantsBulkCreate?.productVariants?.length || 0} missing variants`);
            }
          }

          updated++;
        } else {
          // Create new product
          const productInput: any = {
            title: product.name,
            descriptionHtml: product.description || "",
            productType: product.category,
            status: "ACTIVE",
          };

          if (productOptions.length > 0) {
            productInput.productOptions = productOptions;
          }

          const data = await shopifyGraphQL(store_url, access_token, CREATE_PRODUCT_MUTATION, {
            product: productInput,
            media: mediaInputs.length > 0 ? mediaInputs : undefined,
          });

          const userErrors = data.productCreate?.userErrors || [];
          if (userErrors.length > 0) {
            throw new Error(userErrors.map((e: any) => e.message).join(", "));
          }

          shopifyProductId = extractGid(data.productCreate.product.id);
          shopifyProductGid = data.productCreate.product.id;

          // Create variants with pricing using productVariantsBulkCreate
          if (variants.length > 0 && productOptions.length > 0) {
            const bulkVariants = buildBulkVariants(variants, product.base_price);
            console.log(`[${product.name}] productOptions:`, JSON.stringify(productOptions));
            console.log(`[${product.name}] variants input count: ${variants.length}`);
            console.log(`[${product.name}] bulkVariants count: ${bulkVariants.length}`);
            console.log(`[${product.name}] sample bulkVariants:`, JSON.stringify(bulkVariants.slice(0, 3)));
            if (bulkVariants.length > 0) {
              const varData = await shopifyGraphQL(store_url, access_token, VARIANTS_BULK_CREATE_MUTATION, {
                productId: shopifyProductGid,
                strategy: "REMOVE_STANDALONE_VARIANT",
                variants: bulkVariants,
              });
              const varErrors = varData.productVariantsBulkCreate?.userErrors || [];
              if (varErrors.length > 0) {
                console.warn(`Variant creation warnings for ${product.name}: ${JSON.stringify(varErrors)}`);
              }
              console.log(`[${product.name}] Created ${varData.productVariantsBulkCreate?.productVariants?.length || 0} variants on Shopify`);
            }
          } else if (product.base_price > 0) {
            // Simple product with no option variants - update the default variant price
            const defaultVariants = data.productCreate?.product?.variants?.edges || [];
            if (defaultVariants.length > 0) {
              const defaultVariantId = defaultVariants[0].node.id;
              await shopifyGraphQL(store_url, access_token, VARIANTS_BULK_UPDATE_MUTATION, {
                productId: shopifyProductGid,
                variants: [{ id: defaultVariantId, price: String(product.base_price), inventoryPolicy: "CONTINUE", inventoryItem: { tracked: false } }],
              });
            }
          }

          created++;
        }

        // --- Publish to Online Store sales channel ---
        try {
          const pubData = await shopifyGraphQL(store_url, access_token, GET_PUBLICATIONS_QUERY, {});
          const publications = pubData.publications?.edges || [];
          const onlineStore = publications.find((e: any) =>
            e.node.name === "Online Store"
          );
          if (onlineStore) {
            const pubResult = await shopifyGraphQL(store_url, access_token, PUBLISHABLE_PUBLISH_MUTATION, {
              id: shopifyProductGid,
              input: [{ publicationId: onlineStore.node.id }],
            });
            const pubErrors = pubResult.publishablePublish?.userErrors || [];
            if (pubErrors.length > 0) {
              console.warn(`Publish warnings for ${product.name}: ${JSON.stringify(pubErrors)}`);
            } else {
              console.log(`[${product.name}] Published to Online Store`);
            }
          } else {
            console.warn(`[${product.name}] Online Store publication not found`);
          }
        } catch (pubErr: any) {
          console.warn(`[${product.name}] Failed to publish: ${pubErr.message}`);
        }

        // --- Disable inventory tracking (infinite inventory) ---
        try {
          const invData = await shopifyGraphQL(store_url, access_token, GET_PRODUCT_VARIANTS_INVENTORY_QUERY, {
            id: shopifyProductGid,
          });
          const variantEdges = invData.product?.variants?.edges || [];
          for (const edge of variantEdges) {
            const invItemId = edge.node.inventoryItem?.id;
            if (invItemId && edge.node.inventoryItem?.tracked !== false) {
              await shopifyGraphQL(store_url, access_token, INVENTORY_ITEM_UPDATE_MUTATION, {
                id: invItemId,
                input: { tracked: false },
              });
            }
          }
          console.log(`[${product.name}] Disabled inventory tracking on ${variantEdges.length} variants`);
        } catch (invErr: any) {
          console.warn(`[${product.name}] Failed to update inventory: ${invErr.message}`);
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
 * Build variant inputs for productVariantsBulkCreate.
 * Each color+size combo becomes a variant with pricing.
 */
function buildBulkVariants(variants: any[], basePrice: number): any[] {
  const bulkVariants: any[] = [];

  for (const variant of variants) {
    const colorName = variant.color || variant.colorName || "";
    const sizes = variant.sizes || [];

    if (sizes.length > 0) {
      for (const size of sizes) {
        const optionValues: { optionName: string; name: string }[] = [];
        if (colorName) optionValues.push({ optionName: "Color", name: colorName });
        if (size.size) optionValues.push({ optionName: "Size", name: size.size });

        bulkVariants.push({
          price: String(size.price || basePrice),
          inventoryPolicy: "CONTINUE",
          optionValues,
          inventoryItem: {
            ...(size.sku ? { sku: size.sku } : {}),
            tracked: false,
          },
        });
      }
    } else if (colorName) {
      // Color-only variant, no sizes
      bulkVariants.push({
        price: String(variant.price || basePrice),
        inventoryPolicy: "CONTINUE",
        optionValues: [{ optionName: "Color", name: colorName }],
        inventoryItem: { tracked: false },
      });
    }
  }

  return bulkVariants;
}

/**
 * Build variant price updates for existing Shopify variants.
 * Matches by option values (Color/Size) and updates prices.
 */
function buildVariantPriceUpdates(existingVariants: any[], localVariants: any[], basePrice: number): any[] {
  // Build a lookup: "Color:Size" → price
  const priceLookup: Record<string, number> = {};
  for (const v of localVariants) {
    const colorName = v.color || v.colorName || "";
    const sizes = v.sizes || [];
    if (sizes.length > 0) {
      for (const s of sizes) {
        const key = [colorName, s.size].filter(Boolean).join(":");
        priceLookup[key] = s.price || basePrice;
      }
    } else if (colorName) {
      priceLookup[colorName] = v.price || basePrice;
    }
  }

  const updates: any[] = [];
  for (const edge of existingVariants) {
    const node = edge.node;
    const opts = node.selectedOptions || [];
    const colorOpt = opts.find((o: any) => o.name === "Color")?.value || "";
    const sizeOpt = opts.find((o: any) => o.name === "Size")?.value || "";
    const key = [colorOpt, sizeOpt].filter(Boolean).join(":");

    if (key && priceLookup[key] !== undefined) {
      updates.push({
        id: node.id,
        price: String(priceLookup[key]),
        inventoryPolicy: "CONTINUE",
        inventoryItem: { tracked: false },
      });
    }
  }

  return updates;
}
