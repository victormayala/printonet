import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Received event:", event.type, "env:", env);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "transaction.completed":
        console.log("Transaction completed:", event.data.object.id);
        break;
      case "transaction.payment_failed":
        console.log("Payment failed:", event.data.object.id);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  console.log("Checkout completed:", session.id, "mode:", session.mode);

  const customizerSessionId = session.metadata?.sessionId;
  if (!customizerSessionId) {
    console.log("No sessionId in metadata, skipping order creation");
    return;
  }

  // Create order record
  const { error } = await supabase.from("orders").insert({
    session_id: customizerSessionId,
    stripe_checkout_id: session.id,
    stripe_payment_intent: session.payment_intent,
    customer_email: session.customer_details?.email || session.customer_email,
    amount_total: session.amount_total,
    currency: session.currency,
    status: "paid",
    environment: env,
  });

  if (error) {
    console.error("Failed to create order:", error);
  }

  // Update customizer session status
  await supabase
    .from("customizer_sessions")
    .update({ status: "ordered" })
    .eq("id", customizerSessionId);
}
