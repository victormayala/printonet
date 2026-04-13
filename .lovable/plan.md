

## Push Products to WooCommerce & Shopify

Currently, the platform only **imports** products from WooCommerce and Shopify into Customizer Studio. There is no functionality to **push** products (especially those sourced from S&S Activewear or created manually) back out to a connected store. This plan adds that capability.

### What gets pushed
For each selected product in "My Products", the system will create (or update) a corresponding product in the connected WooCommerce or Shopify store, including:
- Name, description, category
- Images (front, back, side views)
- Variants (colors and sizes from S&S data)
- Base pricing

### Implementation

**1. New edge function: `export-to-woocommerce`**
- Accepts a list of `inventory_products` IDs plus WooCommerce credentials
- For each product, calls the WooCommerce REST API `POST /wp-json/wc/v3/products` to create a product with:
  - Title, description, images array
  - Variable product type with color/size attributes
  - Variant creation via `POST /wp-json/wc/v3/products/{id}/variations`
- Returns success/failure counts

**2. New edge function: `export-to-shopify`**
- Accepts product IDs plus Shopify credentials (store URL + access token)
- Calls Shopify Admin API `POST /admin/api/2024-01/products.json` to create products with:
  - Title, body_html, images
  - Options (Color, Size) and variants
- Returns success/failure counts

**3. Frontend: "Push to Store" action in Products page**
- Add a "Push to Store" button that appears when products are selected and a store integration exists
- Shows a dialog letting the user choose which connected store to push to
- Displays progress and results (created/failed counts)
- Tracks which products have been pushed via a `external_ids` field in `supplier_source` JSONB to avoid duplicates on re-push

**4. Database: No schema changes needed**
- The existing `supplier_source` JSONB column on `inventory_products` can store the remote product ID after push (e.g., `{ "wc_product_id": 123 }`)
- The existing `store_integrations` table already has credentials for both platforms

### Technical details
- WooCommerce variable products require creating the parent product first, then POSTing each variation separately
- Shopify handles variants inline in the product create call (up to 100 variants per product)
- Image URLs from S&S or uploaded images are passed as-is; both APIs accept external URLs
- Re-pushing an already-exported product will update it (PUT) instead of creating a duplicate

