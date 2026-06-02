// Shared helper: ensure a dashboard-only corporate store exists for a
// Shopify/WooCommerce integration, and link imported inventory products to it.
//
// These stores are intentionally NOT provisioned on the storefront app
// (no tenant_slug, no /sites page). They exist only as catalog containers
// inside the dashboard so users can manage products per connected shop.

type SupabaseClient = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2").createClient>;

export type SyncPlatform = "shopify" | "woocommerce";

const normalizeStoreUrl = (value: string) => value.trim().replace(/\/+$/, "");

/**
 * Returns the corporate_stores.id for the integration, creating one if needed.
 * Also writes the store_id back onto the store_integrations row.
 */
export async function ensureSyncStore(
  supabase: SupabaseClient,
  params: {
    user_id: string;
    platform: SyncPlatform;
    store_url: string;
    // Optional fallback name (e.g. shop hostname). If absent we derive from store_url.
    name?: string;
  },
): Promise<string> {
  const { user_id, platform } = params;
  const store_url = normalizeStoreUrl(params.store_url);

  // 1. Find the integration row.
  const { data: integ, error: integErr } = await supabase
    .from("store_integrations")
    .select("id, store_id")
    .eq("user_id", user_id)
    .eq("platform", platform)
    .maybeSingle();
  if (integErr) throw integErr;

  // 2. If integration already has a valid store, return it.
  if (integ?.store_id) {
    const { data: existing } = await supabase
      .from("corporate_stores")
      .select("id")
      .eq("id", integ.store_id)
      .maybeSingle();
    if (existing?.id) return existing.id;
  }

  // 3. Reuse an existing dashboard-only store for this same integration URL if
  // the integration row lost its store_id during an older connect flow.
  const { data: existingByName } = await supabase
    .from("corporate_stores")
    .select("id")
    .eq("user_id", user_id)
    .eq("store_type", platform)
    .eq("custom_domain", store_url)
    .maybeSingle();
  if (existingByName?.id) {
    if (integ?.id) {
      await supabase.from("store_integrations").update({ store_id: existingByName.id }).eq("id", integ.id);
    }
    return existingByName.id;
  }

  // 4. Otherwise create the store.
  const { data: userRes } = await supabase.auth.admin.getUserById(user_id);
  const contactEmail = userRes?.user?.email ?? `${user_id}@printonet.local`;

  const derivedName = (() => {
    if (params.name) return params.name;
    try {
      const host = new URL(store_url).hostname;
      return platform === "shopify"
        ? host.replace(/\.myshopify\.com$/i, "") + " (Shopify)"
        : host + " (WooCommerce)";
    } catch {
      return platform === "shopify" ? "Shopify Store" : "WooCommerce Store";
    }
  })();

  const { data: created, error: createErr } = await supabase
    .from("corporate_stores")
    .insert({
      user_id,
      name: derivedName,
      contact_email: contactEmail,
      custom_domain: store_url,
      store_type: platform, // 'shopify' | 'woocommerce'
      status: "active",     // dashboard-only; no provisioning needed
      tenant_slug: null,
    })
    .select("id")
    .single();
  if (createErr) throw createErr;

  // 4. Link it back to the integration.
  if (integ?.id) {
    await supabase
      .from("store_integrations")
      .update({ store_id: created.id })
      .eq("id", integ.id);
  }

  return created.id;
}

/**
 * Link a freshly-imported inventory product to the integration's store.
 */
export async function linkProductToSyncStore(
  supabase: SupabaseClient,
  params: { user_id: string; store_id: string; product_id: string },
): Promise<void> {
  await supabase
    .from("corporate_store_products")
    .upsert(
      {
        user_id: params.user_id,
        store_id: params.store_id,
        product_id: params.product_id,
        is_active: true,
      },
      { onConflict: "store_id,product_id", ignoreDuplicates: true },
    );
}
