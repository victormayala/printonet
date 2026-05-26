import { useParams, useSearchParams, Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";

import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Checkout() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const { items, clearCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<{ name: string; image: string | null; qty: number; price: number }[]>([]);
  // Store id resolved from any cart item or fallback session — drives Connect routing.
  const [storeId, setStoreId] = useState<string | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<{
    clientSecret: string;
    stripePromise: Promise<Stripe | null>;
  } | null>(null);

  const priceOverride = searchParams.get("price");

  useEffect(() => {
    const ids = items.length > 0 ? items.map((i) => i.sessionId) : sessionId ? [sessionId] : [];
    if (ids.length === 0) {
      if (items.length === 0) {
        setError("No items to checkout.");
        setLoading(false);
      }
      return;
    }

    (supabase as any)
      .rpc("get_customizer_sessions", { p_ids: ids })
      .then(({ data }: { data: any }) => {
        const sid = data?.find((r: any) => r.store_id)?.store_id ?? null;
        setStoreId(sid);

        if (items.length === 0 && data && data[0]) {
          const pd = data[0].product_data as any;
          const dout = data[0].design_output as any;
          const side = dout?.sides?.find((s: any) => s.previewPNG || s.designPNG);
          const qty = parseInt(searchParams.get("qty") || "1", 10);
          const price = priceOverride
            ? parseInt(priceOverride, 10)
            : pd?.base_price
            ? Math.round(pd.base_price * 100)
            : 1000;
          setPreviews([
            {
              name: pd?.name || "Custom Product",
              image: side?.previewPNG || side?.designPNG || null,
              qty,
              price,
            },
          ]);
        }
        setLoading(false);
      });

    if (items.length > 0) {
      setPreviews(
        items.map((i) => ({
          name: i.productName,
          image: i.previewImage,
          qty: i.quantity,
          price: i.priceInCents,
        })),
      );
    }
  }, [sessionId, items.length]);

  const totalCents = useMemo(
    () => previews.reduce((sum, p) => sum + p.price * p.qty, 0),
    [previews],
  );
  const productName = useMemo(
    () =>
      previews.length === 1
        ? `${previews[0].name} (x${previews[0].qty})`
        : `${previews.length} custom items`,
    [previews],
  );
  const cartSessionIds = useMemo(
    () =>
      items.length > 0 ? items.map((i) => i.sessionId).join(",") : sessionId || "",
    [items, sessionId],
  );

  useEffect(() => {
    if (loading || error || previews.length === 0 || checkoutSession) return;

    let cancelled = false;
    const createSession = async () => {
      try {
        if (storeId) {
          const { data, error: fnError } = await supabase.functions.invoke("stripe-connect-checkout", {
            body: {
              storeId,
              amountInCents: totalCents,
              quantity: 1,
              productName,
              sessionId: cartSessionIds,
              returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
            },
          });
          if (fnError || !data?.clientSecret || !data?.publishableKey || !data?.accountId) {
            throw new Error(fnError?.message || data?.error || "Failed to create checkout session");
          }
          if (!cancelled) {
            setCheckoutSession({
              clientSecret: data.clientSecret,
              stripePromise: loadStripe(data.publishableKey, { stripeAccount: data.accountId }),
            });
          }
        } else {
          const { data, error: fnError } = await supabase.functions.invoke("create-checkout", {
            body: {
              amountInCents: totalCents,
              quantity: 1,
              productName,
              sessionId: cartSessionIds,
              returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
              environment: getStripeEnvironment(),
            },
          });
          if (fnError || !data?.clientSecret) {
            throw new Error(fnError?.message || data?.error || "Failed to create checkout session");
          }
          if (!cancelled) {
            setCheckoutSession({ clientSecret: data.clientSecret, stripePromise: getStripe() });
          }
        }
        if (!cancelled && items.length > 0) clearCart();
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Unable to start checkout.");
      }
    };

    createSession();
    return () => {
      cancelled = true;
    };
  }, [loading, error, previews.length, checkoutSession, storeId, totalCents, productName, cartSessionIds, items.length, clearCart]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || previews.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">{error || "Nothing to checkout"}</p>
      </div>
    );
  }

  const fetchClientSecret = useCallback(async (): Promise<string> => {
    if (!checkoutSession?.clientSecret) throw new Error("Checkout session is not ready");
    return checkoutSession.clientSecret;
  }, [checkoutSession?.clientSecret]);
  const checkoutOptions = useMemo(() => ({ fetchClientSecret }), [fetchClientSecret]);

  return (
    <div className="min-h-screen bg-background">
      
      <div className="max-w-5xl mx-auto p-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/cart">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to cart
          </Link>
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Order Summary</h2>
            {previews.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 rounded-lg object-contain bg-muted/30 border border-border"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.qty}</p>
                </div>
                <span className="text-sm font-medium text-foreground">
                  ${((item.price * item.qty) / 100).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex justify-between font-semibold text-foreground">
              <span>Total</span>
              <span>${(totalCents / 100).toFixed(2)}</span>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Payment</h2>
            {checkoutSession ? (
              <div className="rounded-xl border border-border overflow-hidden">
                <EmbeddedCheckoutProvider stripe={checkoutSession.stripePromise} options={checkoutOptions}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            ) : (
              <div className="rounded-xl border border-border min-h-[320px] flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
