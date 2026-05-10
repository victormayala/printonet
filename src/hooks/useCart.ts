import { useState, useEffect, useCallback } from "react";

export interface CartItem {
  sessionId: string;
  productName: string;
  previewImage: string | null;
  quantity: number;
  priceInCents: number; // unit price
  variant?: string;
  wcProductId?: string;
  /** Persisted from review query — required for variable products on wc-ajax add_to_cart */
  wcVariationId?: string;
  wcAttributes?: Record<string, string>;
  /** Woo store origin when shopper arrived from an external storefront (survives cart refresh without query string) */
  storeOrigin?: string;
  shopifyVariantId?: string;
}

const CART_KEY = "customizer_cart";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function toStringOrUndefined(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim() !== "") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

function toPositiveInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
}

function toNonNegativeInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function normalizeCartItem(raw: unknown): CartItem | null {
  const row = asRecord(raw);
  if (!row) return null;

  const sessionId = toStringOrUndefined(row.sessionId) || toStringOrUndefined(row.session_id);
  const productName = toStringOrUndefined(row.productName) || toStringOrUndefined(row.product_name);
  if (!sessionId || !productName) return null;

  const preview = toStringOrUndefined(row.previewImage) || toStringOrUndefined(row.preview_image);
  const wcProductId =
    toStringOrUndefined(row.wcProductId) ||
    toStringOrUndefined(row.wc_product_id) ||
    toStringOrUndefined(row.product_id);
  const wcVariationId =
    toStringOrUndefined(row.wcVariationId) ||
    toStringOrUndefined(row.wc_variation_id) ||
    toStringOrUndefined(row.variation_id);
  const storeOrigin =
    toStringOrUndefined(row.storeOrigin) ||
    toStringOrUndefined(row.store_origin) ||
    toStringOrUndefined(row.storeUrl);
  const shopifyVariantId =
    toStringOrUndefined(row.shopifyVariantId) || toStringOrUndefined(row.shopify_variant_id);
  const variant = toStringOrUndefined(row.variant);

  let wcAttributes: Record<string, string> | undefined;
  const attrs = asRecord(row.wcAttributes) || asRecord(row.wc_attributes);
  if (attrs) {
    wcAttributes = {};
    Object.keys(attrs).forEach((k) => {
      const val = toStringOrUndefined(attrs[k]);
      if (val !== undefined) wcAttributes![k] = val;
    });
    if (Object.keys(wcAttributes).length === 0) wcAttributes = undefined;
  }

  return {
    sessionId,
    productName,
    previewImage: preview || null,
    quantity: toPositiveInt(row.quantity, 1),
    priceInCents: toNonNegativeInt(row.priceInCents ?? row.price_in_cents, 0),
    variant,
    wcProductId,
    wcVariationId,
    wcAttributes,
    storeOrigin,
    shopifyVariantId,
  };
}

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeCartItem(row))
      .filter((row): row is CartItem => row !== null);
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

/** Track the last broadcast item to include in message for WC sync */
let _lastAddedItem: CartItem | null = null;

/** Broadcast cart count to parent window (for embedded store widget) */
function broadcastCartCount(items: CartItem[]) {
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const newItem = _lastAddedItem ? {
    sessionId: _lastAddedItem.sessionId,
    wcProductId: _lastAddedItem.wcProductId || null,
    wcVariationId: _lastAddedItem.wcVariationId || null,
    wcAttributes: _lastAddedItem.wcAttributes || null,
    shopifyVariantId: _lastAddedItem.shopifyVariantId || null,
    quantity: _lastAddedItem.quantity,
    previewImage: _lastAddedItem.previewImage || null,
  } : null;
  _lastAddedItem = null;
  const message = {
    source: "customizer-studio",
    type: "cart-updated",
    payload: { totalItems, itemCount: items.length, newItem },
  };
  // Post to parent (if embedded)
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, "*");
  }
  // Also post to opener (if opened via window.open)
  if (window.opener) {
    try { window.opener.postMessage(message, "*"); } catch (_) {}
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    saveCart(items);
    broadcastCartCount(items);
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
    _lastAddedItem = item;
    setItems((prev) => {
      const existing = prev.find((i) => i.sessionId === item.sessionId);
      if (existing) {
        return prev.map((i) =>
          i.sessionId === item.sessionId ? { ...i, quantity: item.quantity } : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const updateQuantity = useCallback((sessionId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((i) => (i.sessionId === sessionId ? { ...i, quantity: Math.max(1, quantity) } : i))
    );
  }, []);

  const removeItem = useCallback((sessionId: string) => {
    setItems((prev) => prev.filter((i) => i.sessionId !== sessionId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalCents = items.reduce((sum, i) => sum + i.priceInCents * i.quantity, 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return { items, addItem, updateQuantity, removeItem, clearCart, totalCents, totalItems };
}
