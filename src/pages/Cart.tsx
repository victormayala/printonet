import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { ShoppingCart, Minus, Plus, Trash2, ArrowLeft, Sparkles } from "lucide-react";

export default function Cart() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, totalCents, totalItems } = useCart();

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
          <Button asChild>
            <Link to="/products">
              <Sparkles className="h-4 w-4 mr-2" /> Browse Products
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleCheckout = () => {
    // Pass all cart items as query params to the checkout page
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
          <Button variant="ghost" size="sm" asChild>
            <Link to="/products">
              <ArrowLeft className="h-4 w-4 mr-2" /> Keep Shopping
            </Link>
          </Button>
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
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/products">
                <Sparkles className="h-4 w-4 mr-2" /> Keep Customizing
              </Link>
            </Button>
            <Button className="flex-[2]" onClick={handleCheckout}>
              <ShoppingCart className="h-4 w-4 mr-2" /> Checkout · ${(totalCents / 100).toFixed(2)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
