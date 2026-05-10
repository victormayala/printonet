import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { transferHostedCartToWoo } from "@/lib/wooCart";
import {
  extractWooColorSelection,
  matchVariantFromWooColor,
  type WooMatchVariant,
} from "@/lib/woo-variant-match";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, ArrowLeft, Minus, Plus, ShoppingCart } from "lucide-react";

interface DesignSide {
  view: string;
  designPNG: string;
  previewPNG?: string;
  productImage?: string;
}

interface VariantSize {
  size: string;
  sku?: string;
  price: number;
  qty?: number;
}

interface DesignVariant {
  color?: string;
  colorName?: string;
  hex?: string;
  sizes?: VariantSize[];
}

interface DesignOutput {
  sessionId?: string;
  sides: DesignSide[];
  variant?: DesignVariant | null;
}

interface SessionRow {
  id: string;
  status: string;
  product_data: any;
  design_output: any;
  external_ref: string | null;
}

export default function ReviewDesign() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addItem } = useCart();
  const [session, setSession] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [sendingToWoo, setSendingToWoo] = useState(false);
  const [transferDebug, setTransferDebug] = useState("idle");
  const [basePriceFallback, setBasePriceFallback] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const returnUrl = searchParams.get("returnUrl") || "";
  const storeOriginParam = searchParams.get("storeOrigin") || "";
  const wcProductId = searchParams.get("wcProductId") || "";
  const wcVariationId = searchParams.get("wcVariationId") || "";
  const wcAttributesParam = searchParams.get("wcAttributes") || "";

  useEffect(() => {
    if (!sessionId) return;
    supabase
      .from("customizer_sessions")
      .select("*")
      .eq("id", sessionId)
      .single()
      .then(async ({ data, error: err }) => {
        if (err || !data) {
          setError("Design not found.");
          setLoading(false);
          return;
        }
        setSession(data as unknown as SessionRow);

        const pd = data.product_data as any;
        let price = pd?.base_price || 0;
        if (!price && pd?.name) {
          const { data: products } = await supabase
            .from("inventory_products")
            .select("base_price")
            .eq("name", pd.name)
            .limit(1);
          if (products && products.length > 0) {
            price = products[0].base_price || 0;
          }
        }
        setBasePriceFallback(price);
        setLoading(false);
      });
  }, [sessionId]);

  const designOutput = session?.design_output as DesignOutput | null;

  const variant = useMemo((): DesignVariant | null => {
    const fromOutput = designOutput?.variant ?? null;
    if (fromOutput && (fromOutput.hex || fromOutput.colorName || fromOutput.color)) {
      return fromOutput;
    }
    const pd = session?.product_data as Record<string, unknown> | undefined;
    if (!pd) return null;
    const variants = pd.variants as WooMatchVariant[] | undefined;
    const wc = pd.wc_attributes as Record<string, string> | undefined;
    if (!variants?.length || !wc || typeof wc !== "object") return null;
    const wooColor = extractWooColorSelection(wc);
    if (!wooColor) return null;
    const m = matchVariantFromWooColor(variants, wooColor);
    return m ? { color: m.color, colorName: m.colorName, hex: m.hex, sizes: m.sizes } : null;
  }, [session, designOutput]);
  const variantSizes: VariantSize[] = useMemo(
    () => (Array.isArray(variant?.sizes) ? variant!.sizes! : []),
    [variant]
  );

  // Default selected size = first in-stock size, or first size, or null
  useEffect(() => {
    if (selectedSize || variantSizes.length === 0) return;
    const inStock = variantSizes.find((s) => (s.qty ?? 0) > 0);
    setSelectedSize((inStock || variantSizes[0]).size);
  }, [variantSizes, selectedSize]);

  // Resolve unit price: selected SKU price → first size price → product base_price
  const unitPrice = useMemo(() => {
    if (selectedSize) {
      const match = variantSizes.find((s) => s.size === selectedSize);
      if (match && Number(match.price) > 0) return Number(match.price);
    }
    if (variantSizes.length > 0 && Number(variantSizes[0].price) > 0) {
      return Number(variantSizes[0].price);
    }
    return basePriceFallback;
  }, [selectedSize, variantSizes, basePriceFallback]);

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
        <div className="text-center space-y-3">
          <h2 className="text-xl font-semibold text-foreground">{error || "Something went wrong"}</h2>
          <p className="text-sm text-muted-foreground">This design session could not be found.</p>
        </div>
      </div>
    );
  }

  const productData = session.product_data as any;
  const productName = productData?.name || "Your Product";
  const variantLabel = variant?.colorName || variant?.color || "";
  const sides = designOutput?.sides?.filter((s) => s.previewPNG || s.designPNG) || [];
  const isEmbedded = window !== window.parent;

  const resolveStoreOrigin = (): string | undefined => {
    const fromQuery = storeOriginParam.trim();
    if (fromQuery.startsWith("http")) {
      try { return new URL(fromQuery).origin; } catch { /* ignore */ }
    }

    if (returnUrl.startsWith("http")) {
      try { return new URL(returnUrl).origin; } catch { /* ignore */ }
    }

    if (document.referrer && document.referrer.startsWith("http")) {
      try { return new URL(document.referrer).origin; } catch { /* ignore */ }
    }

    try {
      const saved = localStorage.getItem("printonet_last_store_origin") || "";
      if (saved.startsWith("https://")) return saved;
    } catch {
      /* ignore */
    }
    return undefined;
  };

  const handleAddToCart = async () => {
    if (addedToCart || sendingToWoo) return;
    const previewSide = sides.find((s) => s.previewPNG) || sides[0];
    const priceInCents = Math.round(unitPrice * 100);
    const variantWithSize = [variantLabel, selectedSize].filter(Boolean).join(" · ");

    let wcAttributes: Record<string, string> | undefined;
    if (wcAttributesParam) {
      try {
        const raw = wcAttributesParam.includes("%") ? decodeURIComponent(wcAttributesParam) : wcAttributesParam;
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          wcAttributes = parsed as Record<string, string>;
        }
      } catch {
        /* ignore invalid wcAttributes query */
      }
    }

    /** Same shape the storefront SDK passes into WooCommerce wc-ajax=add_to_cart */
    const wooSyncPayload = {
      ...(designOutput ?? { sides: [] }),
      quantity,
      sessionId,
      selectedSize,
      ...(wcProductId ? { wcProductId } : {}),
      ...(wcVariationId ? { wcVariationId } : {}),
      ...(wcAttributes ? { wcAttributes } : {}),
    };
    const storeOrigin = resolveStoreOrigin();

    // Preferred path: send directly to Woo from this screen.
    if (storeOrigin) {
      setSendingToWoo(true);
      setTransferDebug(`attempting transfer to ${storeOrigin}`);
      const transfer = await transferHostedCartToWoo(storeOrigin, [
        {
          wcProductId: wcProductId || undefined,
          wcVariationId: wcVariationId || undefined,
          wcAttributes,
          productName,
          quantity,
          sessionId: sessionId || "",
          previewImage: previewSide?.previewPNG || previewSide?.designPNG || null,
        },
      ]);
      if (transfer.ok && transfer.redirectUrl) {
        setTransferDebug(`transfer ok -> ${transfer.redirectUrl}`);
        setAddedToCart(true);
        window.location.href = transfer.redirectUrl;
        return;
      }
      setSendingToWoo(false);
      setTransferDebug(`transfer failed: ${transfer.error || "unknown_error"}`);
      toast({
        variant: "destructive",
        title: "Direct Woo transfer failed",
        description: transfer.error || "No redirect URL returned from store.",
      });
      return;
    }

    setTransferDebug("no store origin detected");
    toast({
      variant: "destructive",
      title: "No store origin detected",
      description: "Cannot send directly to Woo from this screen.",
    });
    return;

  };

  const keepShoppingHref = returnUrl || "/products";
  const isExternal = returnUrl.startsWith("http");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Design Complete!</h1>
          <div className="flex items-center justify-center gap-2 text-muted-foreground flex-wrap">
            {variant?.hex ? (
              <span
                className="h-6 w-6 shrink-0 rounded-full border border-border shadow-sm"
                style={{ backgroundColor: variant.hex }}
                title={variantLabel || variant.hex}
                aria-hidden
              />
            ) : null}
            <p>
              {productName}
              {variantLabel ? ` · ${variantLabel}` : ""}
            </p>
          </div>
        </div>

        {/* Preview grid */}
        {sides.length > 0 && (
          <div className={`grid gap-4 ${sides.length === 1 ? "grid-cols-1 max-w-sm mx-auto" : "grid-cols-2"}`}>
            {sides.map((side) => (
              <div key={side.view} className="rounded-xl border border-border overflow-hidden bg-muted/30">
                <div className="px-3 py-2 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {side.view}
                  </span>
                </div>
                <img
                  src={side.previewPNG || side.designPNG}
                  alt={`${side.view} preview`}
                  className="w-full aspect-square object-contain bg-muted/20"
                />
              </div>
            ))}
          </div>
        )}

        {/* Size selector */}
        {variantSizes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Size</span>
              {selectedSize && unitPrice > 0 && (
                <span className="text-xs text-muted-foreground">
                  ${unitPrice.toFixed(2)} each
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {variantSizes.map((s) => {
                const isActive = selectedSize === s.size;
                const outOfStock = (s.qty ?? 0) === 0 && s.qty !== undefined;
                return (
                  <button
                    key={s.size}
                    onClick={() => setSelectedSize(s.size)}
                    disabled={outOfStock}
                    className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    } ${outOfStock ? "opacity-40 cursor-not-allowed line-through" : ""}`}
                    title={outOfStock ? "Out of stock" : `$${Number(s.price).toFixed(2)}`}
                  >
                    {s.size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity selector */}
        <div className="flex items-center justify-center gap-4">
          <span className="text-sm text-muted-foreground">Quantity</span>
          <div className="flex items-center gap-2 border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-3 py-2 hover:bg-muted transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="px-4 py-2 font-medium text-foreground min-w-[3rem] text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="px-3 py-2 hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {unitPrice > 0 && (
            <span className="text-sm font-medium text-foreground">
              ${(unitPrice * quantity).toFixed(2)}
            </span>
          )}
        </div>

        {/* Session reference */}
        {sessionId && (
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/50 border border-border">
            <span className="text-xs text-muted-foreground">Design Reference</span>
            <span className="text-xs font-mono text-foreground select-all">{sessionId.slice(0, 8)}</span>
          </div>
        )}

        <div className="px-4 py-3 rounded-lg bg-muted/40 border border-border space-y-1">
          <p className="text-xs text-muted-foreground">
            Store origin: <span className="text-foreground">{resolveStoreOrigin() || "not detected"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Woo product id: <span className="text-foreground">{wcProductId || "none"}</span> · variation id:{" "}
            <span className="text-foreground">{wcVariationId || "none"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Transfer debug: <span className="text-foreground">{transferDebug}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {isExternal ? (
            <Button variant="outline" className="flex-1" asChild>
              <a href={keepShoppingHref}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Keep Shopping
              </a>
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" asChild>
              <Link to={`/embed/${sessionId}?allowCompleted=1`}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Edit Design
              </Link>
            </Button>
          )}
          <Button
            className="flex-[2]"
            onClick={() => void handleAddToCart()}
            disabled={addedToCart || sendingToWoo}
            variant={addedToCart ? "outline" : "default"}
          >
            {sendingToWoo ? (
              <><ShoppingCart className="h-4 w-4 mr-2" /> Sending to store…</>
            ) : addedToCart ? (
              <><CheckCircle className="h-4 w-4 mr-2" /> Added!</>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart{unitPrice > 0 ? ` · $${(unitPrice * quantity).toFixed(2)}` : ""}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
