

## Plan: S&S Activewear Supplier Integration

### What this adds
A new "Suppliers" integration in the Products page that lets store owners connect their S&S Activewear account and browse/import blank products directly into their inventory, with periodic pricing and stock sync.

### How it works

1. **Store S&S credentials** — The user enters their S&S Account Number and API Key. These are saved to the existing `store_integrations` table with `platform = 'ssactivewear'`.

2. **Edge function: `import-ssactivewear-products`** — A new backend function that:
   - Authenticates with the S&S REST API (Basic Auth: Account Number + API Key)
   - Fetches styles via `GET /v2/styles/` (with optional category/search filter)
   - For each style, fetches products via `GET /v2/products/?style={styleID}` to get color variants, images, and pricing
   - Maps the data to `inventory_products` rows:
     - `name` = brandName + styleName + title (e.g. "Gildan 2000 — Ultra Cotton T-Shirt")
     - `category` = baseCategory
     - `description` = style description
     - `base_price` = customerPrice (or piecePrice)
     - `image_front/back/side1/side2` = colorFrontImage, colorBackImage, colorSideImage (prefixed with `https://www.ssactivewear.com/`)
     - `variants` = array of `{ color, colorName, hex, size, sku, price, qty }` grouped by color
   - Upserts into `inventory_products` keyed on a supplier reference stored in the product's metadata

3. **Browsing UI** — A new tab/dialog on the Products page:
   - "Suppliers" tab alongside the existing product list
   - Connect form for S&S credentials (Account Number + API Key)
   - Once connected, show a searchable catalog browser fetching styles from S&S via the edge function
   - Each style shows brand, name, image, available colors count, and base price
   - "Import" button per style imports it as an inventory product
   - "Sync All" button re-imports all previously imported supplier products to refresh pricing/stock

4. **Pricing sync** — A `sync-supplier-products` edge function that can be called manually (or later via cron) to update pricing and inventory quantities for all S&S-sourced products.

### Files to create/change

| File | Action |
|------|--------|
| `supabase/functions/import-ssactivewear-products/index.ts` | **Create** — Edge function to browse styles and import products from S&S API |
| `src/pages/Products.tsx` | **Edit** — Add "Suppliers" tab with S&S connection form and catalog browser UI |
| Database migration | **Create** — Add `supplier_source` jsonb column to `inventory_products` to track origin (supplier, style ID, last synced) |

### S&S API mapping

```text
S&S Style  →  inventory_products row
─────────────────────────────────────
brandName + styleName  →  name
baseCategory           →  category
title + description    →  description
styleImage             →  image_front (default)
colorFrontImage        →  image_front (per variant)
colorBackImage         →  image_back
colorSideImage         →  image_side1
customerPrice          →  base_price
color variants         →  variants[] (color, hex, sizes, SKUs)
```

### Security
- S&S credentials are stored encrypted in `store_integrations` (existing RLS: user can only access their own)
- The edge function validates the JWT and only fetches credentials for the authenticated user
- API calls to S&S happen server-side only — credentials never reach the browser

### Technical details
- S&S API uses Basic Auth: `Authorization: Basic base64(accountNumber:apiKey)`
- Images use the pattern `https://www.ssactivewear.com/{imagePath}`; replace `_fm` with `_fl` for large images
- Products endpoint returns SKU-level data (one row per size/color combo); the edge function groups these by color to create variant arrays
- The `supplier_source` column enables filtering supplier-imported vs manually-added products and powers the sync feature

