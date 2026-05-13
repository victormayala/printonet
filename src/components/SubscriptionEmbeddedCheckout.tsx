import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useCallback, useState } from "react";
import { AlertCircle } from "lucide-react";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  priceId: string;
  extraStores?: number;
  returnUrl?: string;
}

export function SubscriptionEmbeddedCheckout({ priceId, extraStores = 0, returnUrl }: Props) {
  const [error, setError] = useState<string | null>(null);

  // Resolve Stripe up-front so a missing publishable key surfaces as an
  // inline error instead of a blank dialog.
  let stripePromise: ReturnType<typeof getStripe> | null = null;
  try {
    stripePromise = getStripe();
  } catch (e) {
    return (
      <CheckoutError
        message={
          e instanceof Error
            ? e.message
            : "Stripe is not configured for this environment."
        }
      />
    );
  }

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("subscription-checkout", {
        body: {
          priceId,
          extraStores,
          environment: getStripeEnvironment(),
          returnUrl: returnUrl ||
            `${window.location.origin}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
        },
      });
      if (fnError || !data?.clientSecret) {
        throw new Error(fnError?.message || data?.error || "Failed to create checkout session");
      }
      return data.clientSecret;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create checkout session";
      setError(msg);
      throw e;
    }
  }, [priceId, extraStores, returnUrl]);

  if (error) return <CheckoutError message={error} />;

  return (
    <div id="checkout" className="min-h-[400px]">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <div className="p-6">
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">Couldn't start checkout</p>
          <p className="text-xs opacity-90">{message}</p>
        </div>
      </div>
    </div>
  );
}
