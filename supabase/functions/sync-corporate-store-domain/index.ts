// Verifies DNS for a corporate store's custom domain and pushes the mapping
// to the Printonet WordPress multisite tenant engine. Updates
// corporate_stores.dns_verified / dns_checked_at on success.

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
  custom_domain: z
    .string()
    .trim()
    .max(255)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i)
    .optional()
    .nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Resolve a hostname's A records using Google DNS-over-HTTPS. Follows CNAME
// chains because the resolver returns the full Answer set.
async function resolveA(hostname: string): Promise<string[]> {
  try {
    const r = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
      { headers: { Accept: "application/dns-json" } },
    );
    if (!r.ok) return [];
    const data = await r.json();
    const answers = Array.isArray(data?.Answer) ? data.Answer : [];
    return answers
      .filter((a: { type: number; data: string }) => a.type === 1)
      .map((a: { data: string }) => a.data);
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { store_id } = parsed.data;
    const customDomain = parsed.data.custom_domain
      ? parsed.data.custom_domain.toLowerCase()
      : null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: store, error: loadErr } = await admin
      .from("corporate_stores")
      .select("*")
      .eq("id", store_id)
      .maybeSingle();
    if (loadErr || !store) return json({ error: "store_not_found" }, 404);
    if (store.user_id !== userId) return json({ error: "forbidden" }, 403);
    if (!store.tenant_slug) return json({ error: "missing_tenant_slug" }, 400);

    // Persist the requested domain immediately so the form state is durable.
    await admin
      .from("corporate_stores")
      .update({
        custom_domain: customDomain,
        // reset verification — re-evaluated below
        dns_verified: false,
        dns_checked_at: new Date().toISOString(),
      })
      .eq("id", store.id);

    // Clearing the domain: tell the tenant to detach and we're done.
    if (!customDomain) {
      await signedTenantCall("/wp-json/printonet/v1/update-store-domain", {
        method: "POST",
        body: {
          tenant_slug: store.tenant_slug,
          custom_domain: null,
        },
      });
      return json({ ok: true, dns_verified: false, custom_domain: null });
    }

    // Strict DNS check when the server IP is configured.
    const expectedIp = Deno.env.get("PRINTONET_STORE_IPV4")?.trim() || null;
    let dnsVerified = false;
    let resolvedIps: string[] = [];
    if (expectedIp) {
      resolvedIps = await resolveA(customDomain);
      dnsVerified = resolvedIps.includes(expectedIp);
      if (!dnsVerified) {
        await admin
          .from("corporate_stores")
          .update({
            dns_verified: false,
            dns_checked_at: new Date().toISOString(),
          })
          .eq("id", store.id);
        return json(
          {
            error: "dns_not_pointing_to_server",
            detail: `Domain ${customDomain} does not resolve to ${expectedIp}.`,
            resolved: resolvedIps,
            expected: expectedIp,
          },
          409,
        );
      }
    } else {
      // No expected IP configured — trust the caller but mark verified=false.
      console.warn(
        "[sync-corporate-store-domain] PRINTONET_STORE_IPV4 not set; skipping strict DNS check",
      );
    }

    // Push to the tenant engine so the WP plugin maps host → tenant blog.
    // Best-effort: if the WP plugin hasn't shipped this endpoint yet, we still
    // persist the verified DNS state and let the user retry later.
    const result = await signedTenantCall(
      "/wp-json/printonet/v1/update-store-domain",
      {
        method: "POST",
        body: {
          tenant_slug: store.tenant_slug,
          custom_domain: customDomain,
          dns_verified: dnsVerified,
        },
      },
    );

    let tenantPushed = false;
    let tenantWarning: string | null = null;
    if ("error" in result) {
      tenantWarning = `${result.error}${result.detail ? `: ${result.detail}` : ""}`;
      console.warn("[sync-corporate-store-domain] tenant unreachable", tenantWarning);
    } else if (!result.ok) {
      const resp = result.response as Record<string, unknown> | null;
      tenantWarning =
        (resp && (resp.message as string)) ||
        (resp && (resp.error as string)) ||
        `Tenant engine error (${result.status})`;
      console.warn(
        "[sync-corporate-store-domain] tenant non-2xx",
        result.status,
        tenantWarning,
      );
    } else {
      tenantPushed = true;
    }

    await admin
      .from("corporate_stores")
      .update({
        dns_verified: dnsVerified,
        dns_checked_at: new Date().toISOString(),
      })
      .eq("id", store.id);

    return json({
      ok: true,
      dns_verified: dnsVerified,
      custom_domain: customDomain,
      resolved: resolvedIps,
      tenant_pushed: tenantPushed,
      tenant_warning: tenantWarning,
    });
  } catch (e) {
    console.error("sync-corporate-store-domain error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
