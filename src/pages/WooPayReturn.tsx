// Stripe redirects here after a successful Woo MP checkout. Verifies the
// session was paid via the MP backend (which also notifies WP), then sends
// the shopper to the Woo thank-you page.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function WooPayReturn() {
  const [sp] = useSearchParams();
  const sessionId = sp.get("session_id") || "";
  const accountId = sp.get("account_id") || "";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !accountId) {
      setError("Missing session details.");
      return;
    }
    (async () => {
      const { data, error } = await supabase.functions.invoke("woo-checkout-complete", {
        body: {
          stripe_checkout_session_id: sessionId,
          stripe_account_id: accountId,
        },
      });
      if (error) {
        setError(error.message || "Failed to confirm payment");
        return;
      }
      if (data?.success_url) {
        window.location.replace(data.success_url);
      } else {
        setError("Payment confirmed, but no return URL was provided.");
      }
    })();
  }, [sessionId, accountId]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">Payment received</h1>
            <p className="text-sm text-muted-foreground">
              We're finalising your order. {error}
            </p>
          </>
        ) : (
          <>
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Finalising your order…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
