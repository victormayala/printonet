import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
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
  const [basePriceFallback, setBasePriceFallback] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const returnUrl = searchParams.get("returnUrl") || "";
  const wcProductId = searchParams.get("wcProductId") || "";

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
  const variant = designOutput?.variant ?? null;
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

  const handleAddToCart = () => {
    const previewSide = sides.find((s) => s.previewPNG) || sides[0];
    const priceInCents = Math.round(unitPrice * 100);
    const variantWithSize = [variantLabel, selectedSize].filter(Boolean).join(" · ");

    addItem({
      sessionId: sessionId!,
      productName,
      previewImage: previewSide?.previewPNG || previewSide?.designPNG || null,
      quantity,
      priceInCents,
      variant: variantWithSize || undefined,
      wcProductId: wcProductId || undefined,
    });

    if (isEmbedded) {
      const payload = { ...designOutput, quantity, sessionId, selectedSize };
      window.parent.postMessage(
        { source: "customizer-studio", type: "review-add-to-cart", payload },
        "*"
      );
      document.dispatchEvent(new CustomEvent("customizer:addtocart", { detail: payload }));
    }

    setAddedToCart(true);
    const cartUrl = returnUrl ? `/cart?returnUrl=${encodeURIComponent(returnUrl)}` : "/cart";
    setTimeout(() => navigate(cartUrl), 600);
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
          <p className="text-muted-foreground">
            {productName}{variantLabel ? ` · ${variantLabel}` : ""}
          </p>
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
              <Link to={`/embed/${sessionId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Edit Design
              </Link>
            </Button>
          )}
          <Button
            className="flex-[2]"
            onClick={handleAddToCart}
            disabled={addedToCart}
            variant={addedToCart ? "outline" : "default"}
          >
            {addedToCart ? (
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
