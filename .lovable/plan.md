
Recommended reset

I recommend we stop using WooCommerce as the place that tries to rebuild the final preview. Right now the preview is being rendered in 3 different places:

- live editor in `src/pages/DesignStudio.tsx`
- summary modal in `public/customizer-sdk.js`
- cart/checkout overlays in `public/customizer-studio-woocommerce.php`

That split is the reason the image keeps drifting.

```text
Customizer
  -> save one canonical preview asset per side
  -> open hosted Review page
  -> hosted Cart / Checkout
  -> optional sync back to WooCommerce
```

Plan

1. Make the saved preview the only source of truth
- Generate previews from a fixed offscreen render size, not from the responsive editor viewport.
- Save per-side composite images plus a primary preview URL on the session.
- Save variant + render metadata so nothing has to be recalculated later.

2. Replace the “design complete” modal with a hosted Review page
- Add a route like `/review/:sessionId`.
- Show the exact saved preview(s), selected color, quantity, price, and Edit / Continue actions.
- This becomes the first thing the customer sees after finishing the design.

3. Recommended path: host cart and checkout here
- Build cart + checkout pages that always display the same saved preview image.
- Use built-in payments for checkout.
- Keep WooCommerce for product import and optional order sync only.

4. Faster fallback if you want a smaller first step
- Skip WooCommerce cart entirely.
- Use the hosted Review page as the confirmation step, then send users straight to external checkout.
- WooCommerce no longer owns preview rendering.

5. Simplify WooCommerce
- Remove thumbnail overlay/fallback rendering as a required shopper flow.
- Keep only metadata storage, add-to-cart handoff if needed, and a “View design” link that opens the hosted review page or saved snapshot.

Technical details
- Frontend: `src/App.tsx`, `src/pages/DesignStudio.tsx`, `public/customizer-sdk.js`, plus new review/cart/checkout pages.
- Backend: extend session data for canonical preview metadata; add protected cart/order tables with proper access rules.
- Key rule: review, cart, checkout, order history, and emails must all read the same stored image URL and never recalculate placement again.

My recommendation
- If you want 1:1 preview all the way through payment, hosted review + hosted cart + hosted checkout in this app is the right solution.
- If you want the quickest reset, build the hosted Review page first and bypass WooCommerce cart thumbnails entirely.
