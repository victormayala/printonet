

## Plan: Integrate Cart with Store Owner's Website

### Problem
When a customer completes a design and adds to cart, the "Keep Shopping" button navigates to `/products` (the dashboard). It should take them back to the store owner's website. Additionally, there's no way for the store to show cart count or access the hosted cart after the customizer closes.

### Approach

**1. Pass the store URL through the flow**

- The loader/SDK already has `data-base-url` and the store's origin. We need to pass a `returnUrl` (the store's URL) through the session so the Review and Cart pages know where to send the customer.
- Add `returnUrl` as a query parameter when the SDK opens the review page, e.g. `/review/:sessionId?returnUrl=https://store.com`
- The Review page passes it along to the Cart page via navigation state or query param.

**2. Update Review page**
- Read `returnUrl` from query params (falling back to `document.referrer` or `/products`)
- Pass `returnUrl` to the Cart page when navigating after "Add to Cart"

**3. Update Cart page**
- Read `returnUrl` from query params or navigation state
- "Keep Shopping" / "Keep Customizing" buttons link to `returnUrl` instead of `/products`
- If no `returnUrl`, fall back to `/products` (dashboard user)

**4. Add a floating cart widget to the SDK/loader**

The loader script will inject a small floating cart badge on the store's page that:
- Shows the current cart item count (reads from the same `localStorage` key `customizer_cart`)
- Clicking it opens the hosted cart page (`BASE_URL + /cart`) in a new tab or iframe overlay
- Automatically appears after the first item is added
- Styled as a small floating button in the bottom-right corner

**5. SDK: Post cart updates back to the parent**

When the Review page adds to cart, it already posts a message. We'll also post the updated cart count so the store's floating widget can update in real-time.

### Files to change

| File | Change |
|------|--------|
| `public/customizer-sdk.js` | Pass `returnUrl` (current page URL) when opening review page; add floating cart widget that reads `customizer_cart` from localStorage and listens for cart update messages |
| `public/customizer-loader.js` | Pass store return URL through to SDK |
| `src/pages/ReviewDesign.tsx` | Read `returnUrl` from query params; pass to cart on navigation |
| `src/pages/Cart.tsx` | Read `returnUrl`; use it for "Keep Shopping" links instead of `/products` |
| `src/hooks/useCart.ts` | After updating cart, post a `window.postMessage` with cart count for cross-window communication |

