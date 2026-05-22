// One-off: creates all subscription products + prices in the BYOK live Stripe account.
// Safe to re-run: uses lookup_keys; existing prices are reused.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import Stripe from "https://esm.sh/stripe@18.5.0";

type PlanDef = {
  product_id: string;       // stable identifier (also used as lookup_key)
  name: string;
  description: string;
  amount: number;           // cents
  interval: "month" | "year";
};

const PLANS: PlanDef[] = [
  { product_id: "customizer_monthly", name: "Printonet Customizer Studio", description: "Embeddable Customizer Studio for your existing site.", amount: 2900, interval: "month" },
  { product_id: "starter_monthly",    name: "Printonet Starter",          description: "1 hosted store, 100 products, 2.5% platform fee.",      amount: 3900, interval: "month" },
  { product_id: "growth_monthly",     name: "Printonet Grow",             description: "3 stores, 250 products/store, 1.5% platform fee.",      amount: 9900, interval: "month" },
  { product_id: "pro_monthly",        name: "Printonet Pro",              description: "10 stores, 500 products/store, 0.5% platform fee.",     amount: 29900, interval: "month" },
  { product_id: "extra_store_monthly",name: "Extra Store Seat",           description: "Add an additional hosted store.",                       amount: 2900, interval: "month" },
  { product_id: "extra_seat_monthly", name: "Extra Team Seat",            description: "Add an additional team member seat.",                   amount: 1000, interval: "month" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sk = Deno.env.get("STRIPE_LIVE_SECRET_KEY");
    if (!sk) throw new Error("STRIPE_LIVE_SECRET_KEY missing");
    const stripe = new Stripe(sk, { apiVersion: "2024-06-20" as any });

    const results: any[] = [];

    for (const def of PLANS) {
      // 1) Reuse product by metadata lookup, else create
      let product: Stripe.Product | undefined;
      const search = await stripe.products.search({
        query: `metadata['lovable_external_id']:'${def.product_id}'`,
        limit: 1,
      });
      if (search.data.length) {
        product = search.data[0];
      } else {
        product = await stripe.products.create({
          name: def.name,
          description: def.description,
          metadata: { lovable_external_id: def.product_id },
        });
      }

      // 2) Reuse price by lookup_key, else create
      const existingPrices = await stripe.prices.list({
        lookup_keys: [def.product_id],
        limit: 1,
      });
      let price: Stripe.Price;
      if (existingPrices.data.length) {
        price = existingPrices.data[0];
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: def.amount,
          currency: "usd",
          recurring: { interval: def.interval },
          lookup_key: def.product_id,
          metadata: { lovable_external_id: def.product_id },
        });
      }

      results.push({
        plan: def.product_id,
        product_id: product.id,
        price_id: price.id,
        lookup_key: price.lookup_key,
        amount: price.unit_amount,
      });
    }

    return new Response(JSON.stringify({ ok: true, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("setup-byok-stripe-products error:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
