// Outbound: POST {TENANT_BASE_URL}/wp-json/printonet/v1/suppliers/validate
// Signed with timestamp+body HMAC (see _shared/printonet-tenant.ts).

import { signedTenantCall, tenantCors } from "../_shared/printonet-tenant.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: tenantCors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  if (!body || typeof body !== "object" || !("tenant_slug" in (body as Record<string, unknown>))) {
    return new Response(JSON.stringify({ error: "tenant_slug_required" }), {
      status: 400,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  const result = await signedTenantCall("/wp-json/printonet/v1/suppliers/validate", {
    method: "POST",
    body,
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
