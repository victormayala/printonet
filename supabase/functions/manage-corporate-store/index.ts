// Pause / resume / delete a tenant subsite on the Printonet WordPress Multisite.
// Uses signed HMAC requests against the network root.

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
  action: z.enum(["pause", "resume", "delete"]),
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
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
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { store_id, action } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store, error: fetchErr } = await admin
      .from("corporate_stores")
      .select("*")
      .eq("id", store_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchErr || !store) {
      return jsonResponse({ error: "Store not found" }, 404);
    }

    // The multisite root exposes manage actions.
    // Delete uses the dedicated /delete-store endpoint with idempotency.
    // Pause/resume continue to use the /tenant/<action> endpoints.
    const payload: Record<string, unknown> =
      action === "delete"
        ? {
            tenant_slug: store.tenant_slug,
            request_id: crypto.randomUUID(),
          }
        : {
            tenant_slug: store.tenant_slug,
            site_id: store.wp_site_id,
            action,
          };

    const path =
      action === "delete"
        ? "/wp-json/printonet/v1/delete-store"
        : action === "pause"
          ? "/wp-json/printonet/v1/tenant/pause"
          : "/wp-json/printonet/v1/tenant/resume";

    const result = await signedTenantCall(path, { method: "POST", body: payload });

    // For delete, treat upstream "not found" as benign — the row is going away anyway.
    const treatAsOk =
      action === "delete" &&
      (("error" in result && false) ||
        (!("error" in result) && (result.ok || result.status === 404)));

    if ("error" in result) {
      if (action !== "delete") {
        return jsonResponse(
          { error: `${result.error}${result.detail ? `: ${result.detail}` : ""}` },
          502,
        );
      }
      // delete + upstream unreachable → still proceed to clean DB row
    } else if (!result.ok && !treatAsOk) {
      const resp = result.response as Record<string, unknown> | string | null;
      const msg =
        (typeof resp === "object" && resp &&
          ((resp as Record<string, unknown>).message as string ||
            (resp as Record<string, unknown>).error as string)) ||
        `Tenant engine error (${result.status})`;
      return jsonResponse({ error: msg }, 502);
    }

    if (action === "delete") {
      const { error: delErr } = await admin
        .from("corporate_stores")
        .delete()
        .eq("id", store_id);
      if (delErr) return jsonResponse({ error: delErr.message }, 500);
      return jsonResponse({ ok: true });
    }

    await admin
      .from("corporate_stores")
      .update({
        status: action === "pause" ? "paused" : "active",
        error_message: null,
      })
      .eq("id", store_id);

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error("manage-corporate-store error", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown" },
      500,
    );
  }
});
