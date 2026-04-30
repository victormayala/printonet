// Provision a new tenant store on the Printonet WordPress Multisite network.
// Calls POST {PRINTONET_TENANT_BASE_URL}/wp-json/printonet/v1/provision-store
// with the shared HMAC signing scheme. InstaWP is no longer used.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { signedTenantCall } from "../_shared/printonet-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  contact_email: z.string().trim().email().max(255),
  custom_domain: z.string().trim().max(255).optional().nullable(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  font_family: z.string().min(1).max(80),
  logo_url: z.string().url().optional().nullable(),
  favicon_url: z.string().url().optional().nullable(),
  // Canonical slug from /slug-availability (required for the multisite handler).
  tenant_slug: z.string().trim().regex(/^[a-z0-9-]{2,63}$/),
  // Idempotency key for safe retries
  request_id: z.string().uuid().optional().nullable(),
  // Optional commerce defaults forwarded to the tenant engine
  currency: z.string().trim().min(3).max(8).optional().nullable(),
  default_country: z.string().trim().min(2).max(8).optional().nullable(),
  weight_unit: z.string().trim().max(8).optional().nullable(),
  dimension_unit: z.string().trim().max(8).optional().nullable(),
});

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

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const body = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotent retries: same request_id from the same user → return existing row.
    const requestId = body.request_id ?? crypto.randomUUID();
    if (body.request_id) {
      const { data: existing } = await admin
        .from("corporate_stores")
        .select("id, tenant_slug, wp_site_id, wp_site_url, wp_admin_url, status")
        .eq("user_id", userId)
        .eq("provision_request_id", body.request_id)
        .maybeSingle();
      if (existing) {
        return new Response(
          JSON.stringify({
            store_id: existing.id,
            tenant_slug: existing.tenant_slug,
            site_id: existing.wp_site_id,
            site_url: existing.wp_site_url,
            admin_url: existing.wp_admin_url,
            idempotent: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Insert row first (status = provisioning) so we can show progress in the UI.
    const { data: store, error: insertErr } = await admin
      .from("corporate_stores")
      .insert({
        user_id: userId,
        name: body.name,
        contact_email: body.contact_email,
        custom_domain: body.custom_domain || null,
        primary_color: body.primary_color,
        font_family: body.font_family,
        logo_url: body.logo_url || null,
        favicon_url: body.favicon_url || null,
        tenant_slug: body.tenant_slug,
        provision_request_id: requestId,
        status: "provisioning",
      })
      .select()
      .single();

    if (insertErr || !store) {
      console.error("DB insert failed", insertErr);
      return new Response(JSON.stringify({ error: "Failed to create store" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the contract payload for the multisite root handler.
    const wpPayload: Record<string, unknown> = {
      tenant_slug: body.tenant_slug,
      request_id: requestId,
      store_name: body.name,
      admin_email: body.contact_email,
      primary_color: body.primary_color,
      secondary_color: body.secondary_color ?? "#f8fafc",
      logo_url: body.logo_url ?? null,
      favicon_url: body.favicon_url ?? null,
      font_family: body.font_family,
      currency: body.currency ?? "USD",
      default_country: body.default_country ?? "US:CA",
      weight_unit: body.weight_unit ?? "lbs",
      dimension_unit: body.dimension_unit ?? "in",
    };
    if (body.custom_domain) wpPayload.custom_domain = body.custom_domain;

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

    if (!result.ok) {
      const resp = result.response as Record<string, unknown> | string | null;
      const msg =
        (typeof resp === "object" && resp &&
          ((resp as Record<string, unknown>).message as string ||
            (resp as Record<string, unknown>).error as string)) ||
        `Tenant engine error (${result.status})`;
      await admin
        .from("corporate_stores")
        .update({ status: "failed", error_message: String(msg) })
        .eq("id", store.id);
      return new Response(
        JSON.stringify({ error: msg, store_id: store.id, upstream: resp }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Expected response shape (per contract):
    //   { site_id, site_url, admin_url, tenant_slug, ... }
    const data = (result.response ?? {}) as Record<string, unknown>;
    const siteIdRaw = data.site_id ?? data.id;
    const siteId =
      siteIdRaw === undefined || siteIdRaw === null ? null : String(siteIdRaw);
    const siteUrl =
      (data.site_url as string | undefined) ??
      (data.url as string | undefined) ??
      null;
    const adminUrl =
      (data.admin_url as string | undefined) ??
      (data.wp_admin_url as string | undefined) ??
      null;
    const canonicalSlug =
      (data.tenant_slug as string | undefined) ?? body.tenant_slug;

    await admin
      .from("corporate_stores")
      .update({
        wp_site_id: siteId,
        wp_site_url: siteUrl,
        wp_admin_url: adminUrl,
        tenant_slug: canonicalSlug,
        // The multisite handler creates the subsite synchronously, so flip
        // straight to active. Branding is pushed in a follow-up call.
        status: siteUrl ? "active" : "provisioning",
        error_message: null,
      })
      .eq("id", store.id);

    // Best-effort branding push (won't fail provisioning if it errors).
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
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("provision-corporate-store error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
