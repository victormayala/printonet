// Finalizes a previously-reserved corporate store by actually creating the
// WordPress multisite tenant. This is the moment the slug is reserved on
// the WP side. Splitting reservation from creation prevents abandoned
// wizards from burning store names.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { signedTenantCall, verifyCustomDomainDns } from "../_shared/printonet-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { store_id } = (await req.json()) as { store_id?: string };
    if (!store_id) {
      return new Response(JSON.stringify({ error: "store_id_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store, error: loadErr } = await admin
      .from("corporate_stores")
      .select("*")
      .eq("id", store_id)
      .single();

    if (loadErr || !store) {
      return new Response(JSON.stringify({ error: "store_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (store.user_id !== userId) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already provisioned? Return existing data idempotently.
    if (store.wp_site_url && store.status === "active") {
      return new Response(
        JSON.stringify({
          store_id: store.id,
          tenant_slug: store.tenant_slug,
          site_url: store.wp_site_url,
          admin_url: store.wp_admin_url,
          idempotent: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!store.tenant_slug) {
      return new Response(
        JSON.stringify({ error: "missing_tenant_slug" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const wpPayload: Record<string, unknown> = {
      tenant_slug: store.tenant_slug,
      request_id: store.provision_request_id ?? store.id,
      store_name: store.name,
      admin_email: store.contact_email,
      primary_color: store.primary_color,
      secondary_color: "#f8fafc",
      logo_url: store.logo_url ?? null,
      favicon_url: store.favicon_url ?? null,
      font_family: store.font_family,
      currency: "USD",
      default_country: "US:CA",
      weight_unit: "lbs",
      dimension_unit: "in",
    };
    if (store.custom_domain) wpPayload.custom_domain = store.custom_domain;

    console.log("[finalize-corporate-store] calling tenant", {
      store_id: store.id,
      tenant_slug: store.tenant_slug,
    });

    const result = await signedTenantCall(
      "/wp-json/printonet/v1/provision-store",
      { method: "POST", body: wpPayload },
    );

    if ("error" in result) {
      const msg = `${result.error}${result.detail ? `: ${result.detail}` : ""}`;
      await admin
        .from("corporate_stores")
        .update({ status: "failed", error_message: msg })
        .eq("id", store.id);
      return new Response(JSON.stringify({ error: msg, store_id: store.id }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data =
      (result.response && typeof result.response === "object"
        ? (result.response as Record<string, unknown>)
        : {}) as Record<string, unknown>;

    const is2xx = result.status >= 200 && result.status < 300;
    const successFlag = data.success === true;
    const siteIdRaw = data.site_id ?? data.id;
    const siteId =
      siteIdRaw === undefined || siteIdRaw === null ? null : String(siteIdRaw);
    const siteUrl =
      (data.site_url as string | undefined) ??
      (data.store_url as string | undefined) ??
      (data.url as string | undefined) ??
      null;
    const adminUrl =
      (data.admin_url as string | undefined) ??
      (data.wp_admin_url as string | undefined) ??
      (data.store_admin_url as string | undefined) ??
      (siteUrl ? `${(siteUrl as string).replace(/\/$/, "")}/wp-admin` : null);
    const storeAdminUrl =
      (data.store_admin_url as string | undefined) ?? adminUrl ?? null;
    const storeLoginUrl =
      (data.store_login_url as string | undefined) ??
      (data.login_url as string | undefined) ??
      (siteUrl ? `${(siteUrl as string).replace(/\/$/, "")}/wp-login.php` : null);
    const adminUsername =
      (data.admin_username as string | undefined) ??
      (data.username as string | undefined) ??
      null;
    const adminPassword =
      (data.admin_password as string | undefined) ??
      (data.password as string | undefined) ??
      null;
    const adminUserIdRaw = data.admin_user_id ?? data.user_id;
    const adminUserId =
      adminUserIdRaw === undefined || adminUserIdRaw === null
        ? null
        : String(adminUserIdRaw);
    const canonicalSlug =
      (data.tenant_slug as string | undefined) ?? store.tenant_slug;

    const provisioned = is2xx && (successFlag || !!siteUrl || !!siteId);

    if (!provisioned) {
      const msg =
        (data.message as string) ||
        (data.error as string) ||
        `Tenant engine error (${result.status})`;
      await admin
        .from("corporate_stores")
        .update({ status: "failed", error_message: String(msg) })
        .eq("id", store.id);
      return new Response(
        JSON.stringify({ error: msg, store_id: store.id, upstream: data }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const dnsCheck = await verifyCustomDomainDns(store.custom_domain);

    await admin
      .from("corporate_stores")
      .update({
        wp_site_id: siteId,
        wp_site_url: siteUrl,
        wp_admin_url: adminUrl,
        store_admin_url: storeAdminUrl,
        store_login_url: storeLoginUrl,
        admin_username: adminUsername,
        admin_password: adminPassword,
        admin_user_id: adminUserId,
        tenant_slug: canonicalSlug,
        status: "active",
        error_message: null,
        dns_verified: dnsCheck.verified,
        dns_checked_at: store.custom_domain ? new Date().toISOString() : null,
      })
      .eq("id", store.id);

    // Best-effort branding push
    if (siteUrl) {
      try {
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/apply-store-branding`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ store_id: store.id }),
          },
        );
      } catch (e) {
        console.error("branding trigger failed", e);
      }
    }

    return new Response(
      JSON.stringify({
        store_id: store.id,
        tenant_slug: canonicalSlug,
        site_id: siteId,
        site_url: siteUrl,
        admin_url: adminUrl,
        store_admin_url: storeAdminUrl,
        store_login_url: storeLoginUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("finalize-corporate-store error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
