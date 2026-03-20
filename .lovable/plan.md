

## Plan: Add "Get Embed Code" per Product

### Problem
After importing products, store owners have no guided next step to embed the customizer in their store. The developer docs exist but require manual work to construct the SDK snippet for each product.

### What We'll Build

**1. "Get Embed Code" button on each product card in `/products`**
- Add a button (e.g., code icon) on each product row/card
- Opens a dialog/modal with a ready-to-use SDK snippet pre-filled with that product's data

**2. Pre-filled embed snippet dialog**
- Generates a complete `CustomizerStudio.init()` + `CustomizerStudio.open()` code block using the product's actual data (name, category, images, variants)
- Includes a copy-to-clipboard button
- Shows a brief "How to use" note: paste into your store's product page HTML
- Links to the full `/developers` docs for advanced options (brand theming, callbacks)

**3. Minor UX: "Next Steps" banner on Products page**
- After products are imported, show a subtle info banner: "Your products are ready! Click the embed code button on any product to add the customizer to your store."
- Links to `/developers` for full documentation

### Technical Details

**Files modified:**
- `src/pages/Products.tsx` — Add embed code button per product, embed code dialog component, and info banner

**Embed snippet generation logic:**
- Read product fields (name, category, image_front, image_back, variants) and interpolate into the SDK template string
- Use the app's `VITE_SUPABASE_URL` and `window.location.origin` for apiUrl/baseUrl (same as Developers page)

No new tables, edge functions, or backend changes needed.

