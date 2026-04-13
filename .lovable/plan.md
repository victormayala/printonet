

## Plan: Keep Hosted Cart, Sync to Store's Native Cart

### Problem
The customizer maintains its own cart (localStorage-based, hosted checkout via Stripe), while the store (e.g. WooCommerce) has its own cart. When a customer adds a customized product, it only appears in the customizer's cart -- the store's cart count and contents stay unchanged, causing confusion.

### Approach

Sync customized items into the store's native cart automatically while keeping the hosted cart as the source of truth for design data and checkout.

**1. Auto-add to WooCommerce cart on "Add to Cart"**

When the Review page fires `review-add-to-cart` via postMessage, the SDK already calls `_addToCart()` which posts to `/?wc-ajax=add_to_cart`. This works for simple products. The issue is that when using the hosted review page (opened in a new tab), the postMessage doesn't reach the store page.

Fix: After adding to the hosted cart, also call back to the store's WooCommerce REST endpoint to add the item to the WC cart. The SDK will do this from the store's origin page when it receives the `cart-updated` message.

**2. SDK listens for cart changes and syncs to WooCommerce**

- When the SDK's floating cart widget receives a `cart-updated` message (from the review/cart page opened in a new tab via `window.opener.postMessage`), it will also trigger WooCommerce add-to-cart for any new items.
- Store the last-synced session IDs in localStorage to avoid duplicate adds.

**3. Pass WC product ID through the flow**

- The loader already knows the `data-wc-product-id`. Pass it through to the review page as a query param so the hosted cart item knows which WC product to sync.
- Store `wcProductId` in the CartItem so the SDK can use it when syncing back.

**4. Update the floating cart widget**

- Instead of showing its own count, the widget will show the combined count (or just link to the store's cart page if WC is detected).
- Add a `cartUrl` config option so store owners can point the widget to their native cart page instead of the hosted one.

### Files to change

| File | Change |
|------|--------|
| `public/customizer-sdk.js` | On `cart-updated` message from opener, call `_addToCart()` with the WC product ID to sync to WooCommerce. Track synced sessions to avoid duplicates. Add `cartUrl` config for widget link target. |
| `public/customizer-loader.js` | Pass `wcProductId` as query param when opening review page. Add `data-cart-url` attribute support. |
| `src/pages/ReviewDesign.tsx` | Read `wcProductId` from query params, include it in the cart item and in the `review-add-to-cart` postMessage payload. |
| `src/hooks/useCart.ts` | Add `wcProductId` to CartItem interface. Include it in broadcast messages so the SDK can sync. |
| `public/customizer-studio-woocommerce.php` | Pass WC product ID through to the customizer session flow so it's available on the review page. |

### How syncing works (sequence)

```text
Customer clicks "Add to Cart" on Review page (new tab)
  ├─ Item saved to localStorage (customizer_cart)
  ├─ postMessage({ type: "cart-updated", payload: { totalItems, newItem: { wcProductId, sessionId } } })
  │     sent to window.opener (store page)
  └─ Navigate to /cart

Store page (SDK running):
  ├─ Receives "cart-updated" message
  ├─ Checks if sessionId already synced (localStorage: customizer_synced_sessions)
  ├─ If not synced & wcProductId exists:
  │     POST /?wc-ajax=add_to_cart with product_id + customizer metadata
  │     jQuery(document.body).trigger('added_to_cart') to update WC mini-cart
  └─ Updates floating widget count
```

### Edge cases handled
- **No WC product ID**: Items without a `wcProductId` (non-WooCommerce stores) skip the sync -- hosted cart/checkout works standalone.
- **Duplicate prevention**: Synced session IDs are tracked in localStorage so refreshing the store page doesn't re-add items.
- **Variable products**: If WC returns an error (variable product needs variation), redirect to product page with session param (existing behavior).

