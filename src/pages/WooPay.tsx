// Landing page that the Printonet WP MU plugin redirects shoppers to after
// "Place order". Reads query args, asks the MP to create a Stripe Connect
// Checkout Session on the tenant's connected account, and mounts the embedded
// checkout form. After payment Stripe redirects to /pay/woo/return.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export default function WooPay() {
  const [sp] = useSearchParams();
  const tenant_slug = sp.get("tenant_slug") || "";
  const order_id = sp.get("order_id") || "";
  const order_key = sp.get("order_key") || "";
  const store_origin = sp.get("store_origin") || "";
  const success_url = sp.get("success_url") || "";
  const cancel_url = sp.get("cancel_url") || "";

  const [error, setError] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const missing = !tenant_slug || !order_id || !order_key || !store_origin || !success_url;

  useEffect(() => {
    if (missing) {
      setError("Missing required parameters from the store.");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("woo-checkout-init", {
        body: { tenant_slug, order_id: Number(order_id), order_key, store_origin, success_url, cancel_url },
      });
      if (cancelled) return;
      if (error) {
        setError(error.message || "Failed to start checkout");
        return;
      }
      if (data?.redirect) {
        window.location.replace(data.redirect);
        return;
      }
      if (!data?.clientSecret || !data?.publishableKey || !data?.accountId) {
        setError("Invalid response from checkout server");
        return;
      }
      setStripePromise(loadStripe(data.publishableKey, { stripeAccount: data.accountId }));
      setClientSecret(data.clientSecret);
    })();
    return () => { cancelled = true; };
  }, [tenant_slug, order_id, order_key, store_origin, success_url, cancel_url, missing]);

  const fetchClientSecret = useMemo(
    () => async () => clientSecret || "",
    [clientSecret],
  );

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Can't start checkout</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          {cancel_url && (
            <a href={cancel_url} className="text-primary underline text-sm">
              Return to cart
            </a>
          )}
        </div>
      </div>
    );
  }

  if (!stripePromise || !clientSecret) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-lg font-semibold text-foreground mb-4">
          Complete your order #{order_id}
        </h1>
        <div className="rounded-xl border border-border overflow-hidden">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
        {cancel_url && (
          <div className="mt-4 text-center">
            <a href={cancel_url} className="text-sm text-muted-foreground underline">
              Cancel and return to cart
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
