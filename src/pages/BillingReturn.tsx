import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function BillingReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const shopifyBilling = params.get("shopify_billing");
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    if (!sessionId && !shopifyBilling) return;
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [sessionId, shopifyBilling]);

  const isShopify = !!shopifyBilling;
  const isError = shopifyBilling === "error";
  const isPending = shopifyBilling === "pending";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="p-8 max-w-md text-center">
        <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">
          {isError ? "Subscription not completed" : isPending ? "Subscription pending" : "Subscription started"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {isError
            ? "We couldn't confirm your Shopify charge. You can try again from the pricing page."
            : isPending
            ? "Shopify is finalizing your charge. This usually takes a few seconds."
            : isShopify
            ? "Your Shopify subscription is active — billed on your next Shopify invoice."
            : sessionId
            ? "Your plan is active. We're setting things up — this usually takes a few seconds."
            : "We couldn't find a checkout session."}
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild>
            <Link to="/billing">Go to Billing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/corporate-stores">Open dashboard</Link>
          </Button>
        </div>
        {(sessionId || isShopify) && seconds <= 0 && (
          <p className="text-xs text-muted-foreground mt-4">
            Plan still not visible? Refresh in a moment — webhooks typically arrive within seconds.
          </p>
        )}
      </Card>
    </div>
  );
}
