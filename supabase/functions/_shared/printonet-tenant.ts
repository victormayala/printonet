// Shared helpers for calling the Printonet WordPress tenant engine.
// Signing scheme:
//   X-Printonet-Timestamp: <unix_seconds>
//   X-Printonet-Signature: hex( HMAC-SHA256( `${timestamp}.${rawBody}`, PLATFORM_HMAC_SECRET ) )
// Tenant allows ~5 min skew. Sign the EXACT bytes sent over the wire.

export const tenantCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function getTenantConfig(): { baseUrl: string; secret: string } | { error: string } {
  const secret = Deno.env.get("PRINTONET_PLATFORM_HMAC_SECRET");
  const rawBase = Deno.env.get("PRINTONET_TENANT_BASE_URL");
  if (!secret || !rawBase) {
    return {
      error:
        "PRINTONET_PLATFORM_HMAC_SECRET and PRINTONET_TENANT_BASE_URL must be set.",
    };
  }
  return { baseUrl: rawBase.replace(/\/+$/, ""), secret };
}

export async function hexHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SignedCallResult {
  ok: boolean;
  status: number;
  response: unknown;
  target: string;
}

export async function signedTenantCall(
  path: string,
  opts: {
    method?: "GET" | "POST";
    body?: unknown; // JSON-serializable; pass undefined to send no body
  } = {},
): Promise<SignedCallResult | { error: string; detail?: string; target?: string }> {
  const cfg = getTenantConfig();
  if ("error" in cfg) return { error: "missing_config", detail: cfg.error };

  const method = opts.method ?? "POST";
  const target = `${cfg.baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  // Build raw body. For GET with no payload, we sign an empty string.
  const rawBody = opts.body === undefined ? "" : JSON.stringify(opts.body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await hexHmacSha256(cfg.secret, `${timestamp}.${rawBody}`);

  const headers: Record<string, string> = {
    "X-Printonet-Timestamp": timestamp,
    "X-Printonet-Signature": signature,
  };
  if (method !== "GET") headers["Content-Type"] = "application/json";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: method === "GET" ? undefined : rawBody,
    });
  } catch (err) {
    return {
      error: "upstream_unreachable",
      detail: err instanceof Error ? err.message : String(err),
      target,
    };
  }

  const text = await upstream.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* leave as text */
  }

  return { ok: upstream.ok, status: upstream.status, response: parsed, target };
}
