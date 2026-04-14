

## Plan: Add SanMar Supplier Integration

SanMar will follow the exact same pattern as the existing S&S Activewear integration — users enter their own SanMar account credentials, browse the catalog, and import products into their inventory.

### SanMar API Details
SanMar uses a SOAP/REST API. Their product data API provides styles, colors, sizes, pricing, and product images. Users need their **SanMar Customer Number** and **API Key** (or username/password depending on the API version).

### Changes

**1. New Edge Function: `supabase/functions/import-sanmar-products/index.ts`**
- Mirror the structure of `import-ssactivewear-products`
- Support actions: `browse`, `import`, `sync`, `details`, `categories`
- Use SanMar's product data API (REST/JSON endpoints) with the user's credentials
- Authenticate via the user's SanMar account number and API key
- Normalize product data into the same `inventory_products` format (name, variants with color/size/price, images)
- Set `supplier_source.provider = 'sanmar'` for tracking

**2. Update `src/pages/Products.tsx`**
- Add a new `SanMarImport` component, modeled after `SSActivewearImport`
- Credential form: SanMar Customer Number + API Key, with instructions on where to find them
- Catalog browser with search, category filtering, pagination
- Style detail dialog showing colors, sizes, pricing
- Single and bulk import with sync support
- Store credentials in `store_integrations` with `platform: 'sanmar'`
- Add a new "SanMar" tab in the suppliers section (or convert the suppliers tab to show both S&S and SanMar)

**3. Update the Suppliers tab layout**
- Replace the single `SSActivewearImport` with a sub-tabbed or accordion layout showing both **S&S Activewear** and **SanMar** as supplier options

### Technical Notes
- SanMar's API base URL: `https://ws.sanmar.com/promostandards/` (PromoStandards) or their proprietary endpoints
- The edge function handles all API communication server-side — user credentials never touch the frontend beyond the initial form
- No database migration needed — reuses existing `inventory_products` and `store_integrations` tables
- The `supplier_source` JSONB column already supports multiple providers

