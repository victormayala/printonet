
## Goal

Distinguish corporate stores (e.g. Pepsi Co.) from retail shop stores in **My Stores**, and let the user attach a per-product corporate logo + position that gets baked into the product images when pushed to that corporate store.

## 1. Mark stores as Corporate vs Retail Shop

**DB migration** on `corporate_stores`:
- Add `store_type text not null default 'retail'` with check constraint `('corporate','retail')`.

**UI — `src/pages/CorporateStores.tsx` and `CorporateStoreDetails.tsx`:**
- Add an "Account type" radio/select in the create + edit form: **Corporate Store** vs **Retail Shop**.
- Show a small `Corporate` badge next to the store name in the list/details when `store_type === 'corporate'`.
- Keep the tab name **My Stores** (no rename, per request).
- Filtering/grouping: optional segmented control at top of My Stores list — *All / Corporate / Retail*.

## 2. Per-product corporate logo + position

**DB migration** — new table `corporate_store_product_logos`:
- `id`, `user_id`, `store_id` (corporate_stores.id), `product_id` (inventory_products.id)
- `logo_url text not null` (uploaded to existing `corporate-store-assets` bucket under `{user_id}/{store_id}/products/{product_id}.png`)
- `view text not null` — one of `front | back | side1 | side2`
- `position jsonb not null` — `{ x_pct, y_pct, width_pct, rotation_deg }` (percentage-based, matching the existing print-area model)
- Unique on `(store_id, product_id, view)`.
- RLS: user owns row when `auth.uid() = user_id`.

**UI — Push to Store dialog (`src/components/PushProductsDialog.tsx`):**
- When the selected destination store has `store_type = 'corporate'`, reveal a **"Corporate logo"** section per selected product:
  - Logo upload (reuses existing logo upload pattern from CorporateStores form, 4 MB max, png/jpg/svg/webp).
  - View selector (Front / Back / Left / Right — only views that exist on the product).
  - Lightweight visual placer: thumbnail of the chosen mockup with a draggable + resizable logo overlay (canvas or absolute-positioned div). Saves `position` as percentages.
  - Persists to `corporate_store_product_logos` on confirm.
- Reuse the saved logo + position next time the same product is pushed to the same corporate store (prefill).

## 3. Bake the logo into product images at push time

**Edge function** — extend `export-to-woocommerce` and `export-to-shopify` (and the `sync-catalog-to-tenant` path used for Printonet multi-tenant Woo):

For each (store, product) being pushed:
1. Look up `corporate_store_product_logos` rows for that pair.
2. For every matching view, server-side composite the logo onto the corresponding mockup image (`image_front`/`image_back`/`image_side1`/`image_side2`):
   - Use Deno `ImageScript` (already available in the runtime) — load mockup, load logo, scale logo to `width_pct * mockup.width`, place at `(x_pct, y_pct)` of the mockup, rotate by `rotation_deg`, encode PNG.
   - Upload the composited PNG to `corporate-store-assets/{user_id}/{store_id}/composites/{product_id}-{view}.png` and use that public URL in the outgoing payload **instead of** the original mockup URL.
3. Main catalog images stay untouched — only the per-store push uses the branded version.

Idempotency: hash `(logo_url, position, mockup_url)` and reuse the cached composite if the hash file already exists.

## 4. Out of scope (explicit)

- No locking the logo as a customizer canvas layer (per answer "At push-to-store time" only).
- No rename of the **My Stores** tab.
- No changes to retail-store push behavior.

## Files touched

- DB migrations: `corporate_stores.store_type` column + new `corporate_store_product_logos` table + RLS.
- `src/types/corporateStore.ts` — add `store_type`.
- `src/pages/CorporateStores.tsx` — type field in create form, badge + filter.
- `src/pages/CorporateStoreDetails.tsx` — type field in edit form, badge.
- `src/components/PushProductsDialog.tsx` — corporate logo upload + placement UI per product (only when target is corporate).
- `supabase/functions/export-to-woocommerce/index.ts`
- `supabase/functions/export-to-shopify/index.ts`
- `supabase/functions/sync-catalog-to-tenant/index.ts`
- New shared helper `supabase/functions/_shared/composite-logo.ts` for ImageScript compositing + caching.

## Open follow-ups (decide later, not blocking)

- Whether the position editor should be a quick "9-point grid + size slider" (faster) vs full free drag (more flexible). Default to **free drag with snap-to-grid**.
- Whether to also expose the same logo on customer-facing customizer for that store (currently no — push-time only).
