// Outbound: GET {TENANT_BASE_URL}/wp-json/printonet/v1/suppliers/sync-status/{job_id}
// Body is empty, so we sign timestamp + "" with PLATFORM_HMAC_SECRET (signing is
// optional per the contract for empty-body GETs, but we always sign for consistency).

import { signedTenantCall, tenantCors } from "../_shared/printonet-tenant.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: tenantCors });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  // Accept job_id either via JSON body { job_id } (POST) or ?job_id=... (GET).
  let job_id: string | null = null;
  if (req.method === "GET") {
    const url = new URL(req.url);
    job_id = url.searchParams.get("job_id");
  } else {
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object" && typeof parsed.job_id === "string") {
        job_id = parsed.job_id;
      }
    } catch {
      /* fall through */
    }
  }

  if (!job_id || !/^[A-Za-z0-9._-]+$/.test(job_id)) {
    return new Response(JSON.stringify({ error: "valid_job_id_required" }), {
      status: 400,
      headers: { ...tenantCors, "Content-Type": "application/json" },
    });
  }

  const result = await signedTenantCall(
    `/wp-json/printonet/v1/suppliers/sync-status/${encodeURIComponent(job_id)}`,
    { method: "GET" },
  );

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
