// Pre-provisioning slug availability check.
// Calls POST {TENANT_BASE_URL}/wp-json/printonet/v1/slug-availability
// using the same HMAC signing scheme as other tenant-engine calls.

import { signedTenantCall, tenantCors } from "../_shared/printonet-tenant.ts";

interface CheckRequest {
  store_name?: string;
  tenant_slug?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: tenantCors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  let body: CheckRequest;
  try {
    body = (await req.json()) as CheckRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  if (!body.store_name && !body.tenant_slug) {
    return new Response(
      JSON.stringify({ error: "store_name_or_tenant_slug_required" }),
      {
        status: 400,
        headers: { ...tenantCors, "Content-Type": "application/json" },
      },
    );
  }

  // Forward only the keys the tenant engine expects.
  const payload: Record<string, string> = {};
  if (body.tenant_slug) payload.tenant_slug = body.tenant_slug;
  else if (body.store_name) payload.store_name = body.store_name;

  const result = await signedTenantCall("/wp-json/printonet/v1/slug-availability", {
    method: "POST",
    body: payload,
  });

  if ("error" in result) {
    return new Response(JSON.stringify(result), {
      status: 502,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 502,
    headers: { ...tenantCors, "Content-Type": "application/json" },
  });
});
