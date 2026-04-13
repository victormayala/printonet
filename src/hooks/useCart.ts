import { useState, useEffect, useCallback } from "react";

export interface CartItem {
  sessionId: string;
  productName: string;
  previewImage: string | null;
  quantity: number;
  priceInCents: number; // unit price
  variant?: string;
  wcProductId?: string;
}

const CART_KEY = "customizer_cart";

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
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
