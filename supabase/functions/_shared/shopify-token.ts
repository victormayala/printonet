// Shared helper to obtain a valid Shopify Admin API access token for a given user.
// Handles Shopify's "expiring offline tokens" (Dec 2025+) by auto-refreshing via the
// stored refresh_token when the access_token is near/past expiry.
//
// Credentials JSON shape stored in `store_integrations.credentials`:
// {
//   access_token: string,
//   refresh_token?: string,
//   expires_at?: string (ISO),                // when access_token expires
//   refresh_token_expires_at?: string (ISO),  // when refresh_token expires (~90 days)
//   scopes?: string,
// }

const SHOPIFY_API_KEY = Deno.env.get("SHOPIFY_API_KEY");
const SHOPIFY_API_SECRET = Deno.env.get("SHOPIFY_API_SECRET");

export interface ShopifyIntegration {
  id: string;
  store_url: string;
  access_token: string;
}

function shopDomainFromUrl(storeUrl: string): string {
  return (storeUrl || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

async function refreshAccessToken(shop: string, refreshToken: string) {
  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
    throw new Error("Shopify OAuth credentials not configured on server");
  }
  const body = new URLSearchParams({
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Shopify token refresh failed (${res.status}): ${text}. The merchant must reconnect their Shopify store.`,
    );
  }
  return await res.json() as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_token_expires_in: number;
    scope?: string;
  };
}

/**
 * Migrate a legacy non-expiring offline token to an expiring one + refresh token.
 * Uses Shopify's RFC 8693 token-exchange against `/admin/oauth/access_token`.
 * Reference: https://github.com/Shopify/shopify-app-js/blob/main/packages/apps/shopify-api/lib/auth/oauth/migrate-to-expiring-token.ts
 */
async function migrateLegacyOfflineToken(shop: string, legacyToken: string) {
  if (!SHOPIFY_API_KEY || !SHOPIFY_API_SECRET) {
    throw new Error("Shopify OAuth credentials not configured on server");
  }
  const OFFLINE_TOKEN_TYPE = "urn:shopify:params:oauth:token-type:offline-access-token";
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: legacyToken,
      subject_token_type: OFFLINE_TOKEN_TYPE,
      requested_token_type: OFFLINE_TOKEN_TYPE,
      expiring: "1",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Shopify legacy-token migration failed (${res.status}): ${text}. The merchant must reconnect their Shopify store.`,
    );
  }
  return await res.json() as {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_token_expires_in: number;
    scope?: string;
  };
}

/**
 * Returns a valid Shopify access token for the given user, refreshing it if needed.
 * Auto-migrates legacy non-expiring tokens (no refresh_token stored) to expiring ones
 * via Shopify's token-exchange endpoint.
 */
export async function getValidShopifyToken(
  supabase: any,
  user_id: string,
): Promise<ShopifyIntegration> {
  const { data: integration, error } = await supabase
    .from("store_integrations")
    .select("id, store_url, credentials")
    .eq("user_id", user_id)
    .eq("platform", "shopify")
    .maybeSingle();

  if (error) throw new Error(`Failed to load Shopify integration: ${error.message}`);
  if (!integration) throw new Error("No Shopify integration found for this user.");

  const creds = (integration.credentials || {}) as any;
  const accessToken: string | undefined = creds.access_token;
  let refreshToken: string | undefined = creds.refresh_token;
  const expiresAt: string | undefined = creds.expires_at;

  if (!accessToken) throw new Error("Stored Shopify access_token is missing.");

  const shop = shopDomainFromUrl(integration.store_url);

  // Legacy non-expiring token (no refresh_token stored). Shopify deprecated these
  // and they will start failing in 2027. Exchange it now for an expiring token + refresh token.
  if (!refreshToken) {
    try {
      const migrated = await migrateLegacyOfflineToken(shop, accessToken);
      const now = Date.now();
      const newCreds = {
        ...creds,
        access_token: migrated.access_token,
        refresh_token: migrated.refresh_token,
        expires_at: new Date(now + migrated.expires_in * 1000).toISOString(),
        refresh_token_expires_at: new Date(
          now + migrated.refresh_token_expires_in * 1000,
        ).toISOString(),
        scopes: migrated.scope ?? creds.scopes ?? "",
        migrated_from_non_expiring_at: new Date(now).toISOString(),
      };
      await supabase
        .from("store_integrations")
        .update({ credentials: newCreds })
        .eq("id", integration.id);
      return {
        id: integration.id,
        store_url: integration.store_url,
        access_token: migrated.access_token,
      };
    } catch (migrateErr) {
      console.error("Legacy Shopify token migration failed:", migrateErr);
      // Fall through with the legacy token; the caller's API request will likely
      // fail and prompt the merchant to reconnect.
      return {
        id: integration.id,
        store_url: integration.store_url,
        access_token: accessToken,
      };
    }
  }

  // Refresh if the access token is expired or expires within 60 seconds.
  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  const needsRefresh = !expiresMs || expiresMs - Date.now() < 60_000;

  if (!needsRefresh) {
    return {
      id: integration.id,
      store_url: integration.store_url,
      access_token: accessToken,
    };
  }

  const refreshed = await refreshAccessToken(shop, refreshToken);

  const now = Date.now();
  const newCreds = {
    ...creds,
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: new Date(now + refreshed.expires_in * 1000).toISOString(),
    refresh_token_expires_at: new Date(
      now + refreshed.refresh_token_expires_in * 1000,
    ).toISOString(),
    scopes: refreshed.scope ?? creds.scopes ?? "",
  };

  await supabase
    .from("store_integrations")
    .update({ credentials: newCreds })
    .eq("id", integration.id);

  return {
    id: integration.id,
    store_url: integration.store_url,
    access_token: refreshed.access_token,
  };
}
