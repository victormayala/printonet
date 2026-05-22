import { loadStripe, Stripe } from "@stripe/stripe-js";

// All BYOK live Stripe for subscriptions. We fetch the publishable key from
// our edge function so we don't have to inject pk_live as a build-time env var.
const FORCED_ENV: "live" | "sandbox" = "live";

let stripePromise: Promise<Stripe | null> | null = null;

async function fetchPublishableKey(env: "live" | "sandbox"): Promise<string> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/get-stripe-publishable-key?env=${env}`,
  );
  if (!res.ok) throw new Error("Failed to load Stripe publishable key");
  const data = await res.json();
  if (!data?.publishableKey) throw new Error("publishableKey missing in response");
  return data.publishableKey;
}

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = fetchPublishableKey(FORCED_ENV).then((pk) => loadStripe(pk));
  }
  return stripePromise;
}

export function getStripeEnvironment(): "live" | "sandbox" {
  return FORCED_ENV;
}
