## Goal

When `hosted_stores_enabled = false`, users should still be able to connect **Shopify** and **WooCommerce** stores and configure their imported products (including print areas) from each store's detail page. Only the **Hosted Stores** (Printonet-hosted storefront) features and the global **Catalog** nav group should be hidden.

## What's wrong today

`HostedStoresRoute` gates the entire `/corporate-stores` and `/corporate-stores/:id` tree, so toggling the flag off hides Shopify and WooCommerce too. The sidebar also drops the whole "My Stores" group, leaving no way in.

## Changes

### 1. Sidebar (`src/components/DashboardSidebar.tsx`)

- Always show the **My Stores** nav group.
- Conditionally include sub-items:
  - "Hosted Stores" → only when `hostedStoresEnabled`
  - "Shopify" and "WooCommerce" → always
- Remove "Catalog" from `baseNavItems` for non-hosted users (super admins and `hosted_stores_enabled = true` users keep it). Catalog (Products/Categories/Suppliers) stays mounted in the router so deep links keep working.

### 2. Routing (`src/App.tsx`)

- Drop the `HostedStoresRoute` wrapper from `/corporate-stores` and `/corporate-stores/:id` so Shopify/Woo stores are always reachable.
- Keep `HostedStoresRoute` on hosted-only routes: `/storefront`, `/websites`, `/websites/:id`.
- Inside `CorporateStoreDetails`, when the user lacks the flag and the store's `store_type === "corporate"`, redirect to `/corporate-stores?tab=shopify` (so they can't open a hosted-only store).

### 3. Corporate Stores list (`src/pages/CorporateStores.tsx`)

- Hide the **Hosted Stores** tab trigger when `hostedStoresEnabled` is false (Shopify and WooCommerce tabs remain).
- Default `tab` falls back to `shopify` instead of `stores` when the flag is off and no `?tab` is present.
- Hide the "Create hosted store" CTA for non-flag users.

### 4. Store details — products & print areas

No code change needed. Each Shopify/WooCommerce store detail page already has a **Products** tab rendering `StoreCustomizableProducts`, which lists imported products and opens `EditProductLogoDialog` → `PrintAreaEditor` for per-product print-area setup. We will verify the tab and dialog behave correctly for `store_type` `shopify` and `woocommerce`.

### 5. Admin toggle

No change. The `Hosted stores` switch in `AdminUsers` keeps controlling the same flag with its new (narrower) meaning.

## Out of scope

- No DB or RLS changes.
- No new permissions on imported products — the existing per-user RLS already covers Shopify/Woo product access.
- Admin sidebar tab stays hidden (per previous request).

## Open question

You said "we don't need to show the catalog group tab" — I read that as **hide the Catalog nav group for users without the hosted-stores flag** (super admins / enabled users still see it). Confirm, or tell me to hide Catalog for everyone.
