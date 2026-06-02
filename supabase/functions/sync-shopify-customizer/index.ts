import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getValidShopifyToken } from "../_shared/shopify-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SHOPIFY_API_VERSION = "2025-01";

function shopDomainFromUrl(storeUrl: string): string {
  return String(storeUrl || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CUSTOMIZER_STUDIO_URL =
    Deno.env.get("CUSTOMIZER_STUDIO_PUBLIC_URL") || "https://platform.printonet.com";

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Missing Authorization" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) return json(401, { error: "Invalid token" });

  let body: { storeId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const storeId = body.storeId;
  if (!storeId || typeof storeId !== "string") return json(400, { error: "storeId is required" });

  const { data: store, error: storeErr } = await admin
    .from("corporate_stores")
    .select("id, user_id, store_type")
    .eq("id", storeId)
    .maybeSingle();
  if (storeErr) return json(500, { error: storeErr.message });
  if (!store) return json(404, { error: "Store not found" });
  if (store.user_id !== userRes.user.id) return json(403, { error: "Not your store" });
  if (store.store_type !== "shopify") return json(400, { error: "Store is not Shopify" });

  const { id: integrationId, store_url, access_token } = await getValidShopifyToken(admin, store.user_id);
  const shop = shopDomainFromUrl(store_url);
  const snippet = `<script src="${loaderSrc}" defer></script>`;
  const manualInstallPayload = {
    ok: true,
    manual_install_required: true,
    loader_src: loaderSrc,
    snippet,
    message:
      "Shopify no longer auto-installs script tags for new apps. Paste the snippet into your theme's theme.liquid just before </head>. You only need to do this once — product toggles update live from Printonet.",
  };
  const isScopeBlocked = (status: number, text: string) =>
    status === 403 || /requires merchant approval/i.test(text) || /script_tags scope/i.test(text);

  const listRes = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/script_tags.json`, {
    headers: { "X-Shopify-Access-Token": access_token, "Content-Type": "application/json" },
  });
  if (!listRes.ok) {
    const text = await listRes.text();
    if (isScopeBlocked(listRes.status, text)) return json(200, manualInstallPayload);
    return json(listRes.status, { error: "Shopify rejected ScriptTag lookup", response: text.slice(0, 1000) });
  }

  const listData = await listRes.json();
  const existing = (listData.script_tags || []).find((tag: { id?: number; src?: string }) =>
    String(tag.src || "").includes("/customizer-loader.js") && String(tag.src || "").includes(`uid=${encodeURIComponent(store.user_id)}`),
  );

  let scriptTagId = existing?.id ?? null;
  if (existing?.id && existing.src !== loaderSrc) {
    const updateRes = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/script_tags/${existing.id}.json`, {
      method: "PUT",
      headers: { "X-Shopify-Access-Token": access_token, "Content-Type": "application/json" },
      body: JSON.stringify({ script_tag: { id: existing.id, src: loaderSrc, event: "onload", display_scope: "online_store" } }),
    });
    if (!updateRes.ok) {
      const text = await updateRes.text();
      if (isScopeBlocked(updateRes.status, text)) return json(200, manualInstallPayload);
      return json(updateRes.status, { error: "Shopify rejected ScriptTag update", response: text.slice(0, 1000) });
    }
    const updated = await updateRes.json();
    scriptTagId = updated.script_tag?.id ?? existing.id;
  } else if (!existing) {
    const createRes = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/script_tags.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": access_token, "Content-Type": "application/json" },
      body: JSON.stringify({ script_tag: { event: "onload", src: loaderSrc, display_scope: "online_store" } }),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      if (isScopeBlocked(createRes.status, text)) return json(200, manualInstallPayload);
      return json(createRes.status, { error: "Shopify rejected ScriptTag creation", response: text.slice(0, 1000) });
    }
    const created = await createRes.json();
    scriptTagId = created.script_tag?.id ?? null;
  }

  if (scriptTagId) {
    await admin.from("store_integrations").update({ script_tag_id: scriptTagId }).eq("id", integrationId);
  }

  return json(200, { ok: true, script_tag_id: scriptTagId, loader_src: loaderSrc, snippet });
});
