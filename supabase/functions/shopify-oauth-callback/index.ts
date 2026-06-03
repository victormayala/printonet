import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ensureSyncStore } from "../_shared/sync-store.ts";

/**
 * Shopify OAuth Step 2: Handle the callback from Shopify.
 * 
 * Shopify redirects here with ?code=...&shop=...&state=...
 * We exchange the code for a permanent access token, save it, then redirect the user back.
 */
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const shop = url.searchParams.get("shop");
    const stateParam = url.searchParams.get("state");

    if (!code || !shop || !stateParam) {
      return new Response("Missing required parameters (code, shop, state)", { status: 400 });
    }

    // Decode state to get user_id and redirect_url
    let userId: string;
    let redirectUrl: string;
    try {
      const stateData = JSON.parse(atob(stateParam));
      userId = stateData.user_id;
      redirectUrl = stateData.redirect_url || "";
    } catch {
      return new Response("Invalid state parameter", { status: 400 });
    }

    if (!userId) {
      return new Response("Missing user_id in state", { status: 400 });
    }

    const clientId = Deno.env.get("SHOPIFY_API_KEY");
    const clientSecret = Deno.env.get("SHOPIFY_API_SECRET");

    if (!clientId || !clientSecret) {
      return new Response("Shopify OAuth not configured on server", { status: 500 });
    }

    // Exchange authorization code for an EXPIRING offline access token (required
    // by Shopify as of Dec 2025 — non-expiring tokens return 403 on API calls).
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      expiring: "1",
    });
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenBody,
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Shopify token exchange failed:", errText);
      return new Response(`Shopify token exchange failed: ${errText}`, { status: 400 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token ?? null;
    const expiresIn = typeof tokenData.expires_in === "number" ? tokenData.expires_in : null;
    const refreshTokenExpiresIn =
      typeof tokenData.refresh_token_expires_in === "number"
        ? tokenData.refresh_token_expires_in
        : null;

    if (!accessToken) {
      return new Response("No access_token in Shopify response", { status: 400 });
    }

    // Save to store_integrations using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const storeUrl = `https://${shop}`;

    // ---- Auto-inject the customizer-loader.js into the merchant's storefront ----
    // Use Shopify's ScriptTag API so the merchant doesn't need to edit theme.liquid.
    const loaderSrc = `https://platform.printonet.com/customizer-loader.js?v=20260603-shopify-pdp-url-detect&uid=${encodeURIComponent(userId)}`;
    let scriptTagId: number | null = null;

    try {
      // 1. Check if a script tag with this src already exists (idempotent on reconnect)
      const listRes = await fetch(
        `https://${shop}/admin/api/2025-01/script_tags.json?src=${encodeURIComponent(loaderSrc)}`,
        { headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" } }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const existing = (listData.script_tags || [])[0];
        if (existing) scriptTagId = existing.id;
      }

      // 2. Create it if missing
      if (!scriptTagId) {
        const createRes = await fetch(`https://${shop}/admin/api/2025-01/script_tags.json`, {
          method: "POST",
          headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            script_tag: {
              event: "onload",
              src: loaderSrc,
              display_scope: "online_store",
            },
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json();
          scriptTagId = created.script_tag?.id ?? null;
          console.log("Registered Shopify ScriptTag:", scriptTagId);
        } else {
          const errText = await createRes.text();
          console.error("Failed to create ScriptTag:", errText);
        }
      } else {
        console.log("ScriptTag already exists, reusing:", scriptTagId);
      }
    } catch (sErr) {
      console.error("ScriptTag registration error:", sErr);
      // Non-fatal — continue with integration save
    }

    // Build credentials payload including the expiring-token fields.
    const nowMs = Date.now();
    const credentialsPayload: Record<string, unknown> = {
      access_token: accessToken,
      scopes: tokenData.scope || "",
    };
    if (refreshToken) credentialsPayload.refresh_token = refreshToken;
    if (expiresIn !== null) {
      credentialsPayload.expires_at = new Date(nowMs + expiresIn * 1000).toISOString();
    }
    if (refreshTokenExpiresIn !== null) {
      credentialsPayload.refresh_token_expires_at = new Date(
        nowMs + refreshTokenExpiresIn * 1000,
      ).toISOString();
    }

    // Upsert: update if same user + platform + store already exists
    const integrationRow = {
      user_id: userId,
      platform: "shopify",
      store_url: storeUrl,
      credentials: credentialsPayload,
      script_tag_id: scriptTagId,
      last_synced_at: null,
    };

    const { error: upsertError } = await supabase
      .from("store_integrations")
      .upsert(integrationRow, { onConflict: "user_id,platform" });

    if (upsertError) {
      console.error("Failed to save integration:", upsertError);
      // Fallback: try insert then update
      const { data: existing } = await supabase
        .from("store_integrations")
        .select("id")
        .eq("user_id", userId)
        .eq("platform", "shopify")
        .maybeSingle();

      if (existing) {
        await supabase
          .from("store_integrations")
          .update({
            store_url: storeUrl,
            credentials: credentialsPayload,
            script_tag_id: scriptTagId,
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("store_integrations")
          .insert(integrationRow);
      }
    }

    try {
      await ensureSyncStore(supabase, {
        user_id: userId,
        platform: "shopify",
        store_url: storeUrl,
      });
    } catch (storeErr) {
      console.error("Failed to ensure Shopify dashboard store:", storeErr);
      return new Response("Shopify connected, but dashboard store creation failed. Please sync products and try again.", { status: 500 });
    }

    // Redirect user back to the app via a proper 302 + meta-refresh fallback.
    // We avoid an HTML interstitial because some contexts (Shopify admin / new-tab popups)
    // render the response as plain text if Content-Type isn't honored.
    const finalRedirect =
      redirectUrl ||
      `${Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "lovable.app")}/corporate-stores?tab=shopify`;

    const fallbackHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${finalRedirect}"><title>Shopify Connected</title></head><body>Redirecting to <a href="${finalRedirect}">${finalRedirect}</a>…</body></html>`;

    return new Response(fallbackHtml, {
      status: 302,
      headers: {
        Location: finalRedirect,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err: any) {
    console.error("Shopify OAuth callback error:", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
});
