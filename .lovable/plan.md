

## Product Detail Page — Shopify-style Variant Manager

Two distinct issues, both rooted in incomplete SanMar data + thin UI. Plan covers both.

## Part 1 — Pull ALL colors from SanMar

**Root cause**: `import-sanmar-products` calls `GetProduct(styleID)` once. SanMar's PromoStandards `GetProduct` for a parent style returns only the parts SanMar's API exposes in that single call — often a subset (~10 colors).

The proper PromoStandards pattern is:
1. `GetProductSellable(styleID)` → returns full list of child `productId`s (one per color)
2. Call `GetProduct(productId)` for **each** color child
3. Merge all parts → full color/size matrix

**Edge function changes** (`supabase/functions/import-sanmar-products/index.ts`):
- Update `import` action: after `GetProductSellable(sid)`, iterate every child productId, call `GetProduct` for each in parallel (batched ~5 at a time to respect rate limits), merge all `parts`
- Reuse same logic in `details` action so the catalog "Details" dialog also shows full colors
- Cache media/pricing per-color so we don't refetch
- Add console logs to confirm the count

## Part 2 — Shopify-style Product Detail Dialog

Replace current `variantDetailProduct` dialog (`src/pages/Products.tsx` ~lines 2664-2792) with a richer layout:

**Left rail — color list**:
- Vertical scrollable list of all variants
- Each row: color swatch + thumbnail image + color name + size count
- Selected color highlighted; click to focus on the right pane

**Right pane — selected variant**:
- Large product image for the selected color (from `variant.colorFrontImage` / `variant.image`)
- Color name + size count
- **Pricing fields per variant**:
  - Base cost (read-only, from supplier)
  - **Profit margin $** (input)
  - **Embroidery fee $** (input)
  - **DTG fee $** (input)
  - Computed **Final Price** = base + margin + embroidery + DTG (live update)
- Sizes grid: each size with its own SKU + price input (existing behavior preserved)

**Top bar**:
- Product name, category, total color count, "Apply pricing to all colors" button (copies margin/fees to every variant)

**Bottom action bar**:
- Save Prices, Cancel (existing)

**Data shape change** — extend each variant object:
```ts
variant.pricing = {
  margin: number,        // profit margin $
  embroidery_fee: number,
  dtg_fee: number,
}
```
Stored inside `variants` jsonb (no schema migration needed). `final_price` is computed client-side and written back into each `size.price` on save.

**Image fix**: the current dialog only uses `variant.colorFrontImage` if present. After Part 1's fix, every color will have its own image URL from SanMar's MediaContent. The new dialog will use `variant.image` first then `variant.colorFrontImage` as fallback.

## Files

**Edit**:
- `supabase/functions/import-sanmar-products/index.ts` — multi-color fetching in import + details
- `src/pages/Products.tsx` — replace variant detail dialog (~lines 2664-2792) with new Shopify-style layout

**No DB migration** — variants is jsonb, extending its shape is safe.

## Out of scope
- Bulk re-import of already-imported SanMar products (user can click "Re-import" on each)
- New table for pricing rules (kept inline on variant for now)
- DTG/embroidery cost lookup tables (manual entry per variant)

## Approve to proceed?
Approving will: rewrite the SanMar import to iterate every color's productId for full coverage, and rebuild the variant detail dialog in a Shopify-inspired layout with per-variant margin/embroidery/DTG pricing inputs.

