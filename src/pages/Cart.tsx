import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { ShoppingCart, Minus, Plus, Trash2, ArrowLeft, Sparkles, Store } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { storeOriginFromReturnUrl, transferHostedCartToWoo } from "@/lib/wooCart";

export default function Cart() {
  const LAST_STORE_ORIGIN_KEY = "printonet_last_store_origin";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, updateQuantity, removeItem, totalCents, totalItems } = useCart();
  const [wooSyncing, setWooSyncing] = useState(false);
  const [autoTransferTried, setAutoTransferTried] = useState(false);
  const [showCartAnyway, setShowCartAnyway] = useState(false);
  const [manualStoreUrl, setManualStoreUrl] = useState("");
  const [storedFallbackOrigin, setStoredFallbackOrigin] = useState<string | null>(null);

  const returnUrl = searchParams.get("returnUrl") || "";
  const keepShoppingHref = returnUrl || "/products";
  const isExternal = returnUrl.startsWith("http");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_STORE_ORIGIN_KEY);
      if (saved && saved.startsWith("https://")) {
        setStoredFallbackOrigin(saved);
        setManualStoreUrl(saved);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const wooStoreOrigin = useMemo(() => {
    const fromQuery = storeOriginFromReturnUrl(returnUrl);
    if (fromQuery) return fromQuery;
    const fromItem = items.find((i) => i.storeOrigin)?.storeOrigin;
    if (fromItem) return fromItem;
    return storedFallbackOrigin || null;
  }, [returnUrl, items, storedFallbackOrigin]);

  const wooLines = useMemo(() => items.filter((i) => i.wcProductId), [items]);
  const transferableLines = useMemo(() => items.filter((i) => i.productName), [items]);
  const canAttemptWooTransfer = Boolean(wooStoreOrigin) && wooLines.length > 0;

  const saveStoreOriginFromInput = () => {
    const raw = manualStoreUrl.trim();
    if (!raw) {
      toast({ variant: "destructive", title: "Enter your store URL", description: "Example: https://royal.stores.printonet.com" });
      return;
    }
    let origin = "";
    try {
      origin = new URL(raw).origin;
    } catch {
      toast({ variant: "destructive", title: "Invalid URL", description: "Use a full https:// URL for your Woo store." });
      return;
    }
    if (!origin.startsWith("https://")) {
      toast({ variant: "destructive", title: "HTTPS required", description: "Store URL must use HTTPS." });
      return;
    }
    setStoredFallbackOrigin(origin);
    setManualStoreUrl(origin);
    try {
      localStorage.setItem(LAST_STORE_ORIGIN_KEY, origin);
    } catch {
      /* ignore */
    }
    toast({ title: "Store URL saved", description: "You can now send these designs to WooCommerce cart." });
  };

  const handleSendToWooCart = async (): Promise<boolean> => {
    if (!wooStoreOrigin) {
      toast({
        variant: "destructive",
        title: "No store linked",
        description: "Open your cart from the store after customizing, or keep shopping from your storefront.",
      });
      return false;
    }
    if (transferableLines.length === 0) {
      toast({ variant: "destructive", title: "Nothing to send", description: "No cart items found to transfer." });
      return false;
    }

    setWooSyncing(true);
    try {
      const syncLines = transferableLines.map((item) => ({
        wcProductId: item.wcProductId,
        wcVariationId: item.wcVariationId,
        wcAttributes: item.wcAttributes,
        productName: item.productName,
        quantity: item.quantity,
        sessionId: item.sessionId,
        previewImage: item.previewImage,
        printFileUrl: item.printFileUrl,
        designLayersUrl: item.designLayersUrl,
      }));
      const r = await transferHostedCartToWoo(wooStoreOrigin, syncLines);
      if (!r.ok || !r.redirectUrl) {
        toast({
          variant: "destructive",
          title: "Could not send cart to your store",
          description:
            r.error ||
            "Ensure WordPress has the Printonet Core MU plugin (v0.1.15+) and try again from HTTPS.",
        });
        return false;
      }
      const target = r.redirectUrl || `${wooStoreOrigin}/cart/`;
      // Primary navigation path.
      window.location.assign(target);
      // Safety fallback in case browser/extensions interfere with first navigation.
      window.setTimeout(() => {
        if (window.location.origin === "https://platform.printonet.com") {
          window.location.href = `${wooStoreOrigin}/cart/`;
        }
      }, 1200);
      return true;
    } finally {
      setWooSyncing(false);
    }
  };

  useEffect(() => {
    if (autoTransferTried) return;
    if (!wooStoreOrigin) return;
    if (transferableLines.length === 0) return;
    if (showCartAnyway) return;
    setAutoTransferTried(true);
    (async () => {
      const ok = await handleSendToWooCart();
      if (!ok) setShowCartAnyway(true);
    })();
  }, [autoTransferTried, wooStoreOrigin, transferableLines.length, showCartAnyway]);

  const KeepShoppingButton = ({ className = "", variant = "ghost" as const, size = "sm" as const, children }: { className?: string; variant?: any; size?: any; children: React.ReactNode }) =>
    isExternal ? (
      <Button variant={variant} size={size} className={className} asChild>
        <a href={keepShoppingHref}>{children}</a>
      </Button>
    ) : (
      <Button variant={variant} size={size} className={className} asChild>
        <Link to={keepShoppingHref}>{children}</Link>
      </Button>
    );

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Your cart is empty</h1>
          <p className="text-sm text-muted-foreground">
            Design a custom product and add it to your cart to get started.
          </p>
          <KeepShoppingButton variant="default" size="default">
            <Sparkles className="h-4 w-4 mr-2" /> Browse Products
          </KeepShoppingButton>
        </div>
      </div>
    );
  }

  const autoTransferMode = !showCartAnyway && Boolean(wooStoreOrigin) && transferableLines.length > 0;
  if (autoTransferMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-6 space-y-3 text-center">
          <h2 className="text-xl font-semibold text-foreground">Sending to your store cart…</h2>
          <p className="text-sm text-muted-foreground">
            Redirecting to <span className="text-foreground">{wooStoreOrigin}</span>.
          </p>
          <Button variant="outline" onClick={() => setShowCartAnyway(true)}>
            Stay on platform cart
          </Button>
        </div>
      </div>
    );
  }

  const handleCheckout = () => {
    const firstItem = items[0];
    const totalAmount = totalCents;
    const productNames = items.map((i) => `${i.productName} (x${i.quantity})`).join(", ");
    const sessionIds = items.map((i) => i.sessionId).join(",");
    navigate(
      `/checkout/${firstItem.sessionId}?qty=1&price=${totalAmount}&cartSessions=${encodeURIComponent(sessionIds)}&cartName=${encodeURIComponent(productNames)}`
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            Your Cart ({totalItems} {totalItems === 1 ? "item" : "items"})
          </h1>
          <KeepShoppingButton>
            <ArrowLeft className="h-4 w-4 mr-2" /> Keep Shopping
          </KeepShoppingButton>
        </div>

        {/* Cart items */}
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.sessionId}
              className="flex gap-4 p-4 rounded-xl border border-border bg-card"
            >
              {/* Preview */}
              {item.previewImage ? (
                <img
                  src={item.previewImage}
                  alt={item.productName}
                  className="w-24 h-24 rounded-lg object-contain bg-muted/30 border border-border flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-muted/30 border border-border flex-shrink-0 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                </div>
              )}

              {/* Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-foreground truncate">{item.productName}</h3>
                  {item.variant && (
                    <p className="text-xs text-muted-foreground">{item.variant}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    ${(item.priceInCents / 100).toFixed(2)} each
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1 border border-border rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.sessionId, item.quantity - 1)}
                      className="px-2.5 py-1.5 hover:bg-muted transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-foreground min-w-[2rem] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.sessionId, item.quantity + 1)}
                      className="px-2.5 py-1.5 hover:bg-muted transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.sessionId)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Line total */}
              <div className="text-right flex-shrink-0">
                <span className="font-semibold text-foreground">
                  ${((item.priceInCents * item.quantity) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary & Actions */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex justify-between text-lg font-semibold text-foreground">
            <span>Total</span>
            <span>${(totalCents / 100).toFixed(2)}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <KeepShoppingButton variant="outline" size="default" className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" /> Keep Customizing
            </KeepShoppingButton>
            <Button
              type="button"
              variant="secondary"
              className="flex-[2]"
              disabled={wooSyncing}
              onClick={() => void handleSendToWooCart()}
            >
              <Store className="h-4 w-4 mr-2" />
              {wooSyncing ? "Sending…" : "Send to store cart (WooCommerce)"}
            </Button>
            <Button className="flex-[2]" onClick={handleCheckout}>
              <ShoppingCart className="h-4 w-4 mr-2" /> Pay here · ${(totalCents / 100).toFixed(2)}
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Store URL for Woo transfer (example: <strong className="text-foreground">https://pepsico.stores.printonet.com</strong>).
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={manualStoreUrl}
                onChange={(e) => setManualStoreUrl(e.target.value)}
                placeholder="https://your-store.stores.printonet.com"
                className="flex-1 h-10 rounded-md border border-border bg-background px-3 text-sm"
              />
              <Button type="button" variant="secondary" onClick={saveStoreOriginFromInput}>
                Save Store URL
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Active store: <strong className="text-foreground">{wooStoreOrigin || "not set"}</strong> · Woo-linked items:{" "}
              <strong className="text-foreground">{wooLines.length}</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
