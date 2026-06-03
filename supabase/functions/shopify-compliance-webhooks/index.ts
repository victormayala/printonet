// Shopify mandatory GDPR compliance webhooks.
// Single endpoint handles all three required topics:
//   - customers/data_request
//   - customers/redact
//   - shop/redact
// HMAC verification uses SHOPIFY_API_SECRET (the app's client secret).
import { createClient } from "npm:@supabase/supabase-js@2";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

async function verifyHmac(rawBody: string, hmacHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get("SHOPIFY_API_SECRET");
  if (!secret || !hmacHeader) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = encodeBase64(new Uint8Array(sig));
  // constant-time-ish compare
  if (expected.length !== hmacHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ hmacHeader.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const hmac = req.headers.get("X-Shopify-Hmac-Sha256");
  const topic = req.headers.get("X-Shopify-Topic") || "";
  const shopDomain = req.headers.get("X-Shopify-Shop-Domain") || "";

  if (!(await verifyHmac(rawBody, hmac))) {
    console.error("compliance webhook: invalid HMAC", { topic, shopDomain });
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Log every compliance request for audit purposes. Best-effort: never block
  // the 200 response on logging failure (Shopify will retry otherwise).
  try {
    await admin.from("shopify_compliance_log").insert({
      topic,
      shop_domain: shopDomain,
      payload,
    });
  } catch (e) {
    console.error("compliance log insert failed (non-fatal):", e);
  }

  try {
    switch (topic) {
      case "customers/data_request": {
        // We do not store Shopify customer PII. Nothing to export.
        // Shopify only requires a 200 acknowledgement.
        console.log("data_request received for shop", shopDomain, "customer", payload?.customer?.id);
        break;
      }
      case "customers/redact": {
        // We do not store Shopify customer PII linked to the merchant's
        // end-customers. Nothing to delete.
        console.log("customers/redact received for shop", shopDomain, "customer", payload?.customer?.id);
        break;
      }
      case "shop/redact": {
        // Triggered 48h after the merchant uninstalls the app. Purge all
        // merchant data we hold for that shop domain.
        await admin
          .from("store_integrations")
          .delete()
          .eq("platform", "shopify")
          .eq("store_url", shopDomain);

        await admin
          .from("store_integrations")
          .delete()
          .eq("platform", "shopify")
          .eq("store_url", `https://${shopDomain}`);

        console.log("shop/redact purged data for", shopDomain);
        break;
      }
      default:
        console.log("compliance webhook: unhandled topic", topic);
    }
  } catch (e) {
    console.error("compliance handler error:", e);
    // Still return 200 — Shopify retries on non-2xx, and we've already
    // logged the request. Better to investigate via logs than spam retries.
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
