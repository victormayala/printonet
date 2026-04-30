// Push branding + optional WooCommerce config to a tenant subsite via the
// network root using the signed /tenant/config endpoint with tenant_slug.
//
// Body:
//   store_id (required)
//   overrides (optional) — partial branding fields to override DB values
//     { store_name?, primary_color?, secondary_color?, font_family?,
//       logo_url?, favicon_url? }
//   woocommerce (optional) — { currency?, default_country?, weight_unit?, dimension_unit? }
//   status (optional) — "active" | "paused" (alias of suspended)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { signedTenantCall } from "../_shared/printonet-tenant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  store_id: z.string().uuid(),
  overrides: z
    .object({
      store_name: z.string().min(1).max(200).optional(),
      primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      font_family: z.string().min(1).max(80).optional(),
      logo_url: z.string().url().nullable().optional(),
      favicon_url: z.string().url().nullable().optional(),
    })
    .optional(),
  woocommerce: z
    .object({
      currency: z.string().min(3).max(8).optional(),
      default_country: z.string().min(2).max(8).optional(),
      weight_unit: z.string().max(8).optional(),
      dimension_unit: z.string().max(8).optional(),
    })
    .optional(),
  status: z.enum(["active", "paused", "suspended"]).optional(),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { store_id, overrides, woocommerce, status } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store } = await admin
      .from("corporate_stores")
      .select("*")
      .eq("id", store_id)
      .maybeSingle();

    if (!store || !store.tenant_slug) {
      return jsonResponse({ error: "Store not ready" }, 400);
    }

    // Build payload from current DB values + caller overrides.
    const payload: Record<string, unknown> = {
      tenant_slug: store.tenant_slug,
      store_name: overrides?.store_name ?? store.name,
      primary_color: overrides?.primary_color ?? store.primary_color,
      secondary_color: overrides?.secondary_color ?? store.accent_color,
      font_family: overrides?.font_family ?? store.font_family,
      logo_url:
        overrides?.logo_url !== undefined ? overrides.logo_url : store.logo_url,
      favicon_url:
        overrides?.favicon_url !== undefined
          ? overrides.favicon_url
          : store.favicon_url,
    };

    if (woocommerce && Object.keys(woocommerce).length > 0) {
      payload.woocommerce = woocommerce;
    }
    if (status) payload.status = status;

    console.log("[apply-store-branding] pushing /tenant/config", {
      store_id,
      tenant_slug: store.tenant_slug,
      keys: Object.keys(payload),
    });

    const result = await signedTenantCall(
      "/wp-json/printonet/v1/tenant/config",
      { method: "POST", body: payload },
    );

    if ("error" in result) {
      const msg = `${result.error}${result.detail ? `: ${result.detail}` : ""}`;
      console.error("[apply-store-branding] upstream unreachable", msg);
      await admin
        .from("corporate_stores")
        .update({ error_message: msg })
        .eq("id", store_id);
      return jsonResponse({ ok: false, error: msg }, 502);
    }

    console.log("[apply-store-branding] response", {
      status: result.status,
      ok: result.ok,
      body: result.response,
    });

    if (!result.ok) {
      const data =
        result.response && typeof result.response === "object"
          ? (result.response as Record<string, unknown>)
          : {};
      const msg =
        (data.message as string) ||
        (data.error as string) ||
        `Tenant engine error (${result.status})`;
      await admin
        .from("corporate_stores")
        .update({ error_message: String(msg) })
        .eq("id", store_id);
      return jsonResponse(
        { ok: false, error: msg, upstream: data },
        502,
      );
    }

    // Mirror local DB so dashboard reflects the pushed values.
    const dbUpdate: Record<string, unknown> = { error_message: null };
    if (overrides?.store_name) dbUpdate.name = overrides.store_name;
    if (overrides?.primary_color) dbUpdate.primary_color = overrides.primary_color;
    if (overrides?.secondary_color) dbUpdate.accent_color = overrides.secondary_color;
    if (overrides?.font_family) dbUpdate.font_family = overrides.font_family;
    if (overrides?.logo_url !== undefined) dbUpdate.logo_url = overrides.logo_url;
    if (overrides?.favicon_url !== undefined) dbUpdate.favicon_url = overrides.favicon_url;
    if (status) dbUpdate.status = status === "active" ? "active" : "paused";

    await admin.from("corporate_stores").update(dbUpdate).eq("id", store_id);

    return jsonResponse({ ok: true, upstream: result.response });
  } catch (e) {
    console.error("apply-store-branding error", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown" },
      500,
    );
  }
});
