import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Exchange authorization code for permanent access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Shopify token exchange failed:", errText);
      return new Response(`Shopify token exchange failed: ${errText}`, { status: 400 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return new Response("No access_token in Shopify response", { status: 400 });
    }

    // Save to store_integrations using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const storeUrl = `https://${shop}`;

    // Upsert: update if same user + platform + store already exists
    const { error: upsertError } = await supabase
      .from("store_integrations")
      .upsert(
        {
          user_id: userId,
          platform: "shopify",
          store_url: storeUrl,
          credentials: { access_token: accessToken, scopes: tokenData.scope || "" },
          last_synced_at: null,
        },
        { onConflict: "user_id,platform" }
      );

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
            credentials: { access_token: accessToken, scopes: tokenData.scope || "" },
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("store_integrations")
          .insert({
            user_id: userId,
            platform: "shopify",
            store_url: storeUrl,
            credentials: { access_token: accessToken, scopes: tokenData.scope || "" },
          });
      }
    }

    // Redirect user back to the app
    const finalRedirect = redirectUrl || `${Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "lovable.app")}/products`;
    // Use a simple HTML page with a success message and redirect
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Shopify Connected</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff;">
  <div style="text-align:center;">
    <h2>✅ Shopify Connected!</h2>
    <p>Redirecting you back...</p>
    <script>
      setTimeout(function() {
        window.location.href = ${JSON.stringify(finalRedirect)};
      }, 1500);
    </script>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err: any) {
    console.error("Shopify OAuth callback error:", err);
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
});
