// Outbound: POST {TENANT_BASE_URL}/wp-json/printonet/v1/provision-store
// Signed with timestamp+body HMAC (see _shared/printonet-tenant.ts).

import { signedTenantCall, tenantCors } from "../_shared/printonet-tenant.ts";

interface ProvisionRequest {
  tenant_slug: string;
  store_name: string;
  admin_email: string;
  // Pass-through extras the tenant engine may understand (logos, branding, etc.)
  [key: string]: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: tenantCors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  let body: ProvisionRequest;
  try {
    body = (await req.json()) as ProvisionRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  const required: (keyof ProvisionRequest)[] = ["tenant_slug", "store_name", "admin_email"];
  for (const k of required) {
    if (!body[k] || typeof body[k] !== "string") {
      return new Response(JSON.stringify({ error: `${k}_required` }), {
        status: 400,
        headers: { ...tenantCors, "Content-Type": "application/json" },
      });
    }
  }

  const result = await signedTenantCall("/wp-json/printonet/v1/provision-store", {
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
