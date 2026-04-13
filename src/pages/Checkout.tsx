import { useParams, useSearchParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface SessionData {
  id: string;
  product_data: any;
  design_output: any;
}

export default function Checkout() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const quantity = parseInt(searchParams.get("qty") || "1", 10);
  const priceParam = searchParams.get("price"); // price in cents from SDK

  useEffect(() => {
    if (!sessionId) return;
    supabase
      .from("customizer_sessions")
      .select("id, product_data, design_output")
      .eq("id", sessionId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) setError("Session not found.");
        else setSession(data as unknown as SessionData);
        setLoading(false);
      });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{error || "Something went wrong"}</p>
      </div>
    );
  }

  const productData = session.product_data as any;
  const designOutput = session.design_output as any;
  const productName = productData?.name || "Custom Product";
  const amountInCents = priceParam ? parseInt(priceParam, 10) : (productData?.base_price ? Math.round(productData.base_price * 100) : 1000);
  const previewSide = designOutput?.sides?.find((s: any) => s.previewPNG || s.designPNG);
  const previewImage = previewSide?.previewPNG || previewSide?.designPNG;

  const fetchClientSecret = async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: {
        amountInCents: amountInCents * quantity,
        quantity: 1, // already multiplied
        productName: `${productName} (x${quantity})`,
        sessionId,
        returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
        environment: getStripeEnvironment(),
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || "Failed to create checkout session");
    }
    return data.clientSecret;
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="max-w-5xl mx-auto p-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to={`/review/${sessionId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to review
          </Link>
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order summary */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Order Summary</h2>
            {previewImage && (
              <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                <img
                  src={previewImage}
                  alt="Design preview"
                  className="w-full aspect-square object-contain"
                />
              </div>
            )}
            <div className="space-y-2 p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{productName}</span>
                <span className="text-foreground">${(amountInCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Quantity</span>
                <span className="text-foreground">{quantity}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span>${((amountInCents * quantity) / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment form */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Payment</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
