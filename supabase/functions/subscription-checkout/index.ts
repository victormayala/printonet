// Creates an embedded Stripe Checkout Session for a Printonet store-owner subscription.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const ALLOWED_PLANS = new Set(["starter_monthly", "growth_monthly", "pro_monthly"]);
const EXTRA_STORE_PRICE = "extra_store_monthly";

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json();
    const { priceId, extraStores = 0, returnUrl, environment } = body;
    if (!ALLOWED_PLANS.has(priceId)) {
      return new Response(JSON.stringify({ error: "invalid_plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const env = (environment === "live" ? "live" : "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Resolve plan price + (optional) extra-store add-on price
    const planPrices = await stripe.prices.list({ lookup_keys: [priceId], limit: 1 });
    if (!planPrices.data.length) throw new Error("Plan price not found");
    const planPrice = planPrices.data[0];

    const lineItems: any[] = [{ price: planPrice.id, quantity: 1 }];

    const seats = Math.max(0, Math.min(50, Number(extraStores) || 0));
    if (seats > 0) {
      const seatPrices = await stripe.prices.list({ lookup_keys: [EXTRA_STORE_PRICE], limit: 1 });
      if (seatPrices.data.length) {
        lineItems.push({ price: seatPrices.data[0].id, quantity: seats });
      }
    }

    const customerId = await resolveOrCreateCustomer(stripe, {
      email: user.email ?? undefined,
      userId: user.id,
    });

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: "subscription",
      ui_mode: "embedded",
      return_url: returnUrl ||
        `${req.headers.get("origin") || "https://platform.printonet.com"}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
      customer: customerId,
      metadata: { userId: user.id, plan: priceId },
      subscription_data: { metadata: { userId: user.id, plan: priceId } },
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("subscription-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
