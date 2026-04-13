import { useState, useEffect, useCallback } from "react";

export interface CartItem {
  sessionId: string;
  productName: string;
  previewImage: string | null;
  quantity: number;
  priceInCents: number; // unit price
  variant?: string;
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

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const addItem = useCallback((item: CartItem) => {
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
