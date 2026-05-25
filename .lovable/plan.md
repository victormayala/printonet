
## Heads-up on MAP

A quick reality check before we build: **MAP (Minimum Advertised Price) is not exposed by SanMar's PromoStandards API** — they only publish `List` (MSRP) and `Customer` (wholesale). **S&S Activewear** likewise returns `customerPrice` (wholesale) and `piecePrice` (open-line / MSRP-equivalent), but no dedicated MAP field. MAP is governed by separate written pricing policies from each supplier.

So the realistic split is:
- **Wholesale** — already imported
- **MSRP** — will be imported automatically from both suppliers
- **MAP** — captured as a **manual override** field per variant (no API source). The toggle still shows the column; if no MAP is set it falls back to "—".

## What gets built

### 1. Importers — pull MSRP alongside wholesale

**`supabase/functions/import-sanmar-products/index.ts`**
- Make two pricing calls per product: `Customer` (wholesale, current behavior) and `List` (MSRP, new).
- Store `msrp` on each size in addition to existing `price`/`cost`.

**`supabase/functions/import-ssactivewear-products/index.ts`**
- Already fetches both `customerPrice` and `piecePrice` but only uses one. Persist `piecePrice` as `msrp` on each size.

No DB migration is required — `variants` is a `jsonb` array on `inventory_products`, so the new `msrp` and `map_price` fields slot into each size object directly.

### 2. Product edit page — display toggle

In `src/pages/Products.tsx`:
- Add a small segmented control at the top of the variant pricing panel: **Wholesale · MSRP · MAP** (defaults to Wholesale).
- The toggle only changes the **reference column** rendered in the size table and the "Base cost" readout — it does NOT change `computeVariantFinalPrice`, decoration-fee math, or "Apply pricing to all colors" (you asked for display-only).
- When **MSRP** is selected, show the `msrp` value per size; if missing, render "—".
- When **MAP** is selected, show the `map_price` value per size and make the field **editable** (since MAP is manual).
- Toggle state is local component state — not persisted per product. Reset when switching products.

### 3. Re-import note

Existing products imported before this change won't have `msrp` populated until they're re-imported. The UI handles missing values gracefully ("—").

## Out of scope

- No changes to how the **selling price** is calculated or shown to customers.
- No changes to Push-to-Store / Shopify / Woo exports.
- No persistent per-product preference for which column to show.
- No automatic MAP fetching (not technically possible from either supplier API).

## Files touched

- `supabase/functions/import-sanmar-products/index.ts`
- `supabase/functions/import-ssactivewear-products/index.ts`
- `src/pages/Products.tsx`
