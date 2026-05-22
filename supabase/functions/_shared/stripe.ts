// supabase/functions/_shared/stripe.ts
// Subscriptions: BYOK Stripe (uses user's own sk_live / whsec_live).
// Connect (per-store checkout): unchanged, still uses STRIPE_CONNECT_SECRET_KEY directly elsewhere.
import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

export type StripeEnv = 'sandbox' | 'live';

function getEnv(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`${key} is not configured`);
  return v;
}

const GATEWAY_STRIPE_BASE = 'https://connector-gateway.lovable.dev/stripe';

/**
 * Build a Stripe client.
 * - live  -> uses STRIPE_LIVE_SECRET_KEY directly (BYOK, no gateway)
 * - sandbox -> falls back to Lovable's connector gateway (legacy test env)
 */
export function createStripeClient(env: StripeEnv): Stripe {
  if (env === 'live') {
    const sk = getEnv('STRIPE_LIVE_SECRET_KEY');
    return new Stripe(sk, { apiVersion: '2024-06-20' as any });
  }

  // Sandbox path: keep existing gateway flow
  const connectionApiKey = Deno.env.get('STRIPE_SANDBOX_API_KEY');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!connectionApiKey || !lovableApiKey) {
    throw new Error('Sandbox Stripe is not configured');
  }
  return new Stripe(connectionApiKey, {
    httpClient: Stripe.createFetchHttpClient((url: string | URL, init?: RequestInit) => {
      const gatewayUrl = url.toString().replace('https://api.stripe.com', GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers).entries()),
          'X-Connection-Api-Key': connectionApiKey,
          'Lovable-API-Key': lovableApiKey,
        },
      });
    }),
  });
}

export async function verifyWebhook(req: Request, env: StripeEnv): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === 'sandbox'
    ? Deno.env.get('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : Deno.env.get('STRIPE_LIVE_WEBHOOK_SECRET');

  if (!secret) throw new Error('Webhook secret env var is not configured');
  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }
  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`)
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));
  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}
