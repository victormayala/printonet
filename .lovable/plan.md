

# Product Connection: Dashboard + Shopify + WordPress

## Overview
Build a product management system that lets store owners connect their products to the customizer via three methods: a manual dashboard, Shopify import, and WordPress/WooCommerce import.

## What Gets Built

### 1. Product Management Dashboard (`/products`)
A UI where store owners can manually add, edit, and delete products:
- Product form: name, category, description, base price, images (front/back/sides), color variants
- Image upload using the existing `product-images` storage bucket
- Product list with edit/delete actions
- Toggle products active/inactive
- Uses the existing `inventory_products` table (already has all needed columns)

### 2. Shopify Import
- A "Connect Shopify" flow on the products page
- Store owner enters their Shopify store URL and a Storefront API access token
- Edge function `import-shopify-products` fetches products from Shopify's Storefront API and inserts them into `inventory_products`
- Maps Shopify product images → front/back, variants → color variants JSON
- One-time import (not live sync) with a "Re-import" button

### 3. WordPress/WooCommerce Import
- A "Connect WooCommerce" flow on the products page
- Store owner enters their WooCommerce REST API URL + consumer key/secret
- Edge function `import-woocommerce-products` fetches products from WooCommerce REST API and inserts into `inventory_products`
- Same one-time import pattern as Shopify

### 4. Product Selector in Customizer
- Update the `/demo` page (or create a proper `/products` browsing page) to load products from `inventory_products` instead of hardcoded sample data
- When a product is selected, open the Design Studio with that product's images

### 5. Navigation Updates
- Add "Products" link to main nav and landing page
- Link the product dashboard from the developer docs page

## Technical Details

**No new tables needed** — `inventory_products` already has all required columns (name, category, description, base_price, image_front/back/side1/side2, variants, is_active).

**New edge functions:**
- `supabase/functions/import-shopify-products/index.ts` — accepts Shopify credentials, calls Storefront API, upserts products
- `supabase/functions/import-woocommerce-products/index.ts` — accepts WooCommerce credentials, calls WC REST API, upserts products

**New pages/components:**
- `src/pages/Products.tsx` — product management dashboard with add/edit forms, import connectors
- Update `src/App.tsx` with `/products` route

**Credentials handling:** Shopify/WooCommerce API keys are passed per-request from the client to the edge function (store owner enters them in the UI). They are not stored server-side unless we add auth later.

## Files Changed
- `src/pages/Products.tsx` (new) — product management dashboard
- `src/App.tsx` — add `/products` route
- `src/pages/Index.tsx` — add Products nav link
- `supabase/functions/import-shopify-products/index.ts` (new)
- `supabase/functions/import-woocommerce-products/index.ts` (new)
- `supabase/config.toml` — JWT config for new functions

